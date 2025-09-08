import * as fs from 'fs';
import * as path from 'path';

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ConversationData {
  messages: ConversationMessage[];
  sessionId: string;
  firstTimestamp: string;
}

interface JsonlEntry {
  type: string;
  message?: {
    role: string;
    content: any;
  };
  timestamp?: string;
  isMeta?: boolean;
}

export class ClaudeExtractor {
  /**
   * JSONLファイルを直接Markdownに変換（元版準拠・シンプル化）
   * @param jsonlPath JSONLファイルのフルパス
   * @returns Markdown形式の文字列
   */
  async convertFile(jsonlPath: string): Promise<string> {
    if (!fs.existsSync(jsonlPath)) {
      throw new Error(`File not found: ${jsonlPath}`);
    }

    const conversationData = this.parseJsonl(jsonlPath);
    
    if (conversationData.messages.length === 0) {
      throw new Error('No valid conversation messages found in file');
    }

    return this.generateMarkdown(conversationData);
  }

  /**
   * JSONLファイルを解析してConversationDataを生成（元版準拠）
   * @param filePath JSONLファイルのパス
   * @returns 会話データ
   */
  private parseJsonl(filePath: string): ConversationData {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const lines = fileContent.split('\n');
    const messages: ConversationMessage[] = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      try {
        const entry: JsonlEntry = JSON.parse(trimmedLine);
        
        // ユーザーメッセージの処理（元版準拠・シンプル化）
        if (entry.type === 'user' && entry.message?.role === 'user') {
          // メタ情報やシステムメッセージをスキップ
          if (entry.isMeta || this.shouldSkipMessage(entry.message.content)) {
            continue;
          }
          
          const content = this.extractTextContent(entry.message.content);
          if (content && content.trim()) {
            messages.push({
              role: 'user',
              content: content.trim(),
              timestamp: entry.timestamp || ''
            });
          }
        }
        
        // アシスタントメッセージの処理（元版準拠・シンプル化）
        if (entry.type === 'assistant' && entry.message?.role === 'assistant') {
          const content = this.extractTextContent(entry.message.content);
          if (content && content.trim()) {
            messages.push({
              role: 'assistant',
              content: content.trim(),
              timestamp: entry.timestamp || ''
            });
          }
        }
        
      } catch (error) {
        // JSON解析エラーは無視（元版と同様）
        continue;
      }
    }
    
    return {
      messages,
      sessionId: path.basename(filePath, '.jsonl'),
      firstTimestamp: messages[0]?.timestamp || ''
    };
  }

  /**
   * メッセージをスキップすべきかどうかを判定（元版準拠・フィルタリング強化）
   */
  private shouldSkipMessage(content: any): boolean {
    if (typeof content === 'string') {
      return content.includes('<command-name>') || 
             content.includes('<local-command-stdout>') ||
             content.includes('system-reminder') ||
             content.includes('Caveat: The messages below') ||
             content.includes('Plan mode is active') ||
             content.includes('Background Bash') ||
             content.includes('[Request interrupted by user]') ||
             content.includes('tool use was rejected');
    }
    
    // 配列の場合、tool_resultが含まれていればスキップ
    if (Array.isArray(content)) {
      return content.some(item => 
        item && typeof item === 'object' && 
        (item.type === 'tool_result' || item.tool_use_id)
      );
    }
    
    return false;
  }

  /**
   * Claude内部の様々なコンテンツ形式からテキストのみを抽出（元版準拠・シンプル化）
   * @param content 任意の形式のコンテンツ
   * @returns 抽出されたテキスト
   */
  private extractTextContent(content: any): string {
    if (typeof content === 'string') {
      return content;
    }
    
    if (Array.isArray(content)) {
      const textParts: string[] = [];
      for (const item of content) {
        if (typeof item === 'object' && item !== null && item.type === 'text') {
          const text = item.text;
          if (typeof text === 'string') {
            textParts.push(text);
          }
        }
        // ツール実行結果は含めない（元版準拠）
      }
      return textParts.join('\n');
    }
    
    if (typeof content === 'object' && content !== null) {
      return String(content);
    }
    
    return String(content);
  }

  /**
   * ConversationDataからMarkdown形式の文字列を生成（元版準拠・シンプル化）
   * @param data 会話データ
   * @returns Markdown形式の文字列
   */
  private generateMarkdown(data: ConversationData): string {
    let markdown = '# Claude Conversation Log\n\n';
    
    // セッション情報
    markdown += `Session ID: ${data.sessionId}\n`;
    
    // 日付情報の処理
    if (data.firstTimestamp) {
      try {
        // ISO形式のタイムスタンプをパース
        const timestamp = data.firstTimestamp.replace('Z', '+00:00');
        const date = new Date(timestamp);
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
        const timeStr = date.toTimeString().split(' ')[0]; // HH:MM:SS
        markdown += `Date: ${dateStr} ${timeStr}`;
      } catch (error) {
        // タイムスタンプ解析に失敗した場合は現在日付を使用
        const now = new Date();
        markdown += `Date: ${now.toISOString().split('T')[0]}`;
      }
    } else {
      // タイムスタンプがない場合は現在日付を使用
      const now = new Date();
      markdown += `Date: ${now.toISOString().split('T')[0]}`;
    }
    
    markdown += '\n\n---\n\n';
    
    // メッセージの処理（元版準拠・シンプル化）
    for (const message of data.messages) {
      if (message.role === 'user') {
        markdown += '## 👤 User\n\n';
        markdown += `${message.content}\n\n`;
      } else {
        markdown += '## 🤖 Claude\n\n';
        markdown += `${message.content}\n\n`;
      }
      markdown += '---\n\n';
    }
    
    return markdown;
  }
}
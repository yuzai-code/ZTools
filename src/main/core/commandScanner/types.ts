export interface Command {
  name: string
  path: string
  icon?: string
  aliases?: string[]
  acronym?: string // 英文首字母缩写（用于搜索）
}

export interface AppScanner {
  scanApplications(): Promise<Command[]>
}

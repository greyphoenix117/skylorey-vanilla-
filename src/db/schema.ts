export type DatabaseSchema = {
  post: Post
  sub_state: SubState
}

export type Post = {
  uri: string
  cid: string
  rkey: string
  replyparent: string | null
  replyroot: string | null
  did: string | null
  indexedat: string
  createdat: string
  flagdelete: boolean
  flaghide: boolean
  tagglobal: string | null
  taglocal: string | null
}

export type SubState = {
  service: string
  cursor: number
}

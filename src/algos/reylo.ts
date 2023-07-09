import { InvalidRequestError } from '@atproto/xrpc-server'
import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'

// max 15 chars
export const shortname = 'reylo-feed'

export const handler = async (ctx: AppContext, params: QueryParams) => {
  let builder = ctx.db
    .selectFrom('post')
    .selectAll()
    .orderBy('createdat', 'desc')
    .orderBy('cid', 'desc')
    .limit(params.limit)

  if (params.cursor) {
    const [cursorDate, cid] = params.cursor.split('::')
    if (!cursorDate || !cid) {
      throw new InvalidRequestError('malformed cursor')
    }
    const timeStr = new Date(parseInt(cursorDate, 10)).toISOString()
    builder = builder
      .where('post.createdat', '<', timeStr)
      .orWhere((qb) => qb.where('post.createdat', '=', timeStr))
      .where('post.cid', '<', cid)
  }
  const res = await builder.execute()

  const feed = res.map((row) => ({
    post: row.uri,
  }))

  let cursor: string | undefined
  const last = res.at(-1)
  if (last) {
    cursor = `${new Date(last.createdat).getTime()}::${last.cid}`
  }

  return {
    cursor,
    feed,
  }
}

import { Database } from '../db'
import { Kysely, Migrator, SqliteDialect } from 'kysely'
import { DatabaseSchema } from '../db/schema'
import dotenv from 'dotenv'
import { RecordNotFoundError } from '@atproto/api/dist/client/types/com/atproto/admin/getRecord';

let fetchCount = 0;
let SAFE_MODE = true;
const MAX_FETCHES = 7;
let rkey_prime = 'initial prime key'

export async function addHistoricalPosts(db) {
  let url = process.env.SEARCH_URL ?? ''
  let dbPosts: {
    uri: string
    cid: string
    replyParent: string | null
    replyRoot: string | null
    indexedAt: string
    createdAt: string
  }[] = []

  if (url) {
    let response = await fetchGuarded(url);
    if (response !== null) {
      let promise = response.json()
      let records = await promise.then(function (results) { return results })
      if (Array.isArray(records)) {
        for (let itmIdx = 0; itmIdx < records.length; itmIdx++) {
          let result = records[itmIdx];

          //Build out the hashtag array to check if the post
          //  should be kept or not
          let hashtags: any[] = []
          result?.post?.text?.toLowerCase()
            ?.match(/#[^\s#\.\;]*/gmi)
            ?.map((hashtag) => {
              hashtags.push(hashtag)
            })

          if (hashtags.includes('#reylo')) {
            //Check if the post is in Hellthread
            let did = result?.user?.did
            let rkey = result?.tid.split("/").slice(-1)[0]
            let record = await getRecord(did, rkey)
            let prom = record.json()
            let posting = await prom.then(function (results) { return results })

            const hellthreadRoots = new Set<string>([`${process.env.HELLTHREAD_ROOT}`])
            let isHellthread = hellthreadRoots.has(posting?.value?.reply?.root?.cid)
            if (!isHellthread && (rkey != '3jzsrjbjti22y' && rkey != '3jzsrjq4lyr2v' && rkey != '3jzrxw7vwqp2w' && rkey != '3jzsrfxgqve2v')) {
              //It's all good; no Hellthread, and has reylo hashtag
              //  add to databaseposts
              dbPosts.push({
                uri: `at://${did}/${result?.tid}`,
                cid: result?.cid,
                replyParent: posting?.value?.reply?.parent?.uri ?? null,
                replyRoot: posting?.value?.reply?.root?.uri ?? null,
                indexedAt: new Date().toISOString(),
                createdAt: result?.post?.createdAt,
              })
            }
          }
        }
      }
    }
    else {
      console.log("Search URL empty")
    }

    //Check if dbPosts is populated; if so, add to database
    if (dbPosts.length > 0) {
      await db
        .insertInto('post')
        .values(dbPosts)
        .onConflict((oc) => oc.doNothing())
        .execute()
    }
  }
}

export function resetFetchCount() {
  fetchCount = 0;
}

export function setSafeMode(safeMode) {
  SAFE_MODE = safeMode;
}

function getSafeMode() {
  return SAFE_MODE;
}

export async function fetchGuarded(url: string) {
  if (getSafeMode() === false) {
    fetchCount++;
    console.log(`fetch ${fetchCount}`);
    return await fetch(url);
  } else {
    fetchCount++;
    if (fetchCount > MAX_FETCHES) {
      console.log(`NOT fetching ${fetchCount}`);
      return null;
    } else {
      console.log(`fetch ${fetchCount}`);
      return await fetch(url);
    }
  }
}

export async function getRecord(did: string, rkey: string) {
  return await fetch(`https://bsky.social/xrpc/com.atproto.repo.getRecord?collection=${process.env.NSID_POST}&repo=${did}&rkey=${rkey}`)
}
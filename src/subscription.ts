import dotenv from 'dotenv'
import {
  OutputSchema as RepoEvent,
  isCommit,
} from './lexicon/types/com/atproto/sync/subscribeRepos'
import { FirehoseSubscriptionBase, getOpsByType } from './util/subscription'

export class FirehoseSubscription extends FirehoseSubscriptionBase {
  async handleEvent(evt: RepoEvent) {
    if (!isCommit(evt)) return
    const ops = await getOpsByType(evt)
    const hellthreadRoots = new Set<string>([`${process.env.HELLTHREAD_ROOT}`])

    const postsToDelete = ops.posts.deletes.map((del) => del.uri)
    const postsToCreate = ops.posts.creates
      .filter((create) => {
        //Like a lot of custom feeds, let's filter out Hellthread posts!
        let reply;
        if (create?.record?.hasOwnProperty('reply')) {
          ({record: {reply}} = create);
        }
        let isHellthread = hellthreadRoots.has(reply?.root?.cid)

        //Build hashtag array from a post text for the check
        let hashtags: any[] = []
        create?.record?.text?.toLowerCase()
          ?.match(/#[^\s#\.\;]*/gmi)
          ?.map((hashtag) => {
            hashtags.push(hashtag)
          })

        //Check for Reylo specific hashtags
        return (hashtags.includes(`${process.env.GLOBAL_TAG}`) ||
                hashtags.includes(`${process.env.LOCAL_TAG_01}`) ||
                hashtags.includes(`${process.env.LOCAL_TAG_02}`)) && 
                !isHellthread 
      })
      .map((create) => {
        //vars for hashtag check
        let globalTag = ''
        let localTag = ''

        //Logic to determine the tags for the post
        let hashtags: any[] = []
        create?.record?.text?.toLowerCase()
          ?.match(/#[^\s#\.\;]*/gmi)
          ?.map((hashtag) => {
            hashtags.push(hashtag)
          })
        
        if(hashtags.includes(`${process.env.GLOBAL_TAG}`)){
          globalTag = process.env.GLOBAL_TAG ?? ''
        } else if (hashtags.includes(`${process.env.LOCAL_TAG_01}`)){
          localTag = process.env.LOCAL_TAG_01 ?? ''
        } else if (hashtags.includes(`${process.env.LOCAL_TAG_02}`)){
          localTag = process.env.LOCAL_TAG_02 ?? ''
        } else {
          //default the global tag to #reylo
          globalTag = '#reylo'
        }

        // map Reylo posts to a db row
        return {
          uri: create.uri,
          cid: create.cid,
          rkey: create?.uri.split("post/").slice(-1)[0] ?? null,
          replyparent: create.record?.reply?.parent.uri ?? null,
          replyroot: create.record?.reply?.root.uri ?? null,
          did: create.author ?? null,
          indexedat: new Date().toISOString(),
          createdat: create.record?.createdAt,
          flagdelete: false,
          flaghide: false,
          tagglobal: globalTag ?? null,
          taglocal: localTag ?? null,
        }
      })

    if (postsToDelete.length > 0) {
      await this.db
        .deleteFrom('post')
        .where('uri', 'in', postsToDelete)
        .execute()
    }
    if (postsToCreate.length > 0) {
      await this.db
        .insertInto('post')
        .values(postsToCreate)
        .onConflict((oc) => oc.doNothing())
        .execute()
    }
  }
}

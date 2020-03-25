import fetch from 'node-fetch'
import { User } from '../database/entities/User'
import querystring from 'query-string'
interface XfUser {
  about?: string
  activity_visible?: boolean
  age: number
  alert_optout?: Object[]
  allow_post_profile?: string
  allow_receive_news_feed?: string
  allow_view_identities?: string
  allow_view_profile?: string
  avatar_urls: Object
  can_ban: boolean
  can_converse: boolean
  can_edit: boolean
  can_follow: boolean
  can_ignore: boolean
  can_post_profile: boolean
  can_view_profile: boolean
  can_view_profile_posts: boolean
  can_warn: boolean
  content_show_signature?: boolean
  creation_watch_state?: string
  custom_fields?: Object
  custom_title?: string
  dob?: Object
  email?: string
  email_on_conversation?: boolean
  gravatar?: string
  interaction_watch_state?: boolean
  is_admin?: boolean
  is_banned?: boolean
  is_discouraged?: boolean
  is_followed: boolean
  is_ignored: boolean
  is_moderator?: boolean
  is_super_admin?: boolean
  last_activity?: number
  location: string
  push_on_conversation?: boolean
  push_optout?: Object[]
  receive_admin_email?: boolean
  secondary_group_ids?: number[]
  show_dob_date?: boolean
  show_dob_year?: boolean
  signature: string
  timezone?: string
  use_tfa?: Object[]
  user_group_id?: number
  user_state?: string
  user_title: string
  visible?: boolean
  warning_points?: number
  website?: string
  user_id: number
  username: string
  message_count: number
  register_date: number
  trophy_points: number
  is_staff: boolean
  reaction_score: number
  [key: string]: any
}

let groups = [
  process.env.XF_GROUP_MEMBER!,
  process.env.XF_GROUP_DONOR!,
  process.env.XF_GROUP_CONTRIBUTOR!,
  process.env.XF_GROUP_TRUSTED!,
  process.env.XF_GROUP_BETA!,
  process.env.XF_GROUP_ALPHA!
]

export async function getUserByUsername(
  username: string
): Promise<boolean | XfUser> {
  const resp = await fetch(
    `${process.env.XF_BASE}/api/users/find-name?username=${encodeURIComponent(
      username
    )}`,
    {
      headers: {
        'XF-Api-Key': process.env.XF_APIKEY!,
        'XF-Api-User': '1'
      }
    }
  )
  const res = await resp.json()
  if (!res.exact) {
    return false
  }
  return res.exact
}
export async function removeGroups(xfUsername: string) {
  let user = await getUserByUsername(xfUsername)
  if (!user) {
    return false
  }
  let xfUser = user as XfUser
  let oldSecondaryGroups = xfUser.secondary_group_ids || []
  let newSecondaryGroups = oldSecondaryGroups.filter(
    id => !groups.includes(id.toString())
  )

  const resp = await fetch(
    `${process.env.XF_BASE}/api/users/${xfUser.user_id}`,
    {
      method: 'POST',
      headers: {
        'XF-Api-Key': process.env.XF_APIKEY!,
        'XF-Api-User': '1',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: querystring.stringify(
        {
          secondary_group_ids: newSecondaryGroups
        },
        {
          arrayFormat: 'bracket'
        }
      )
    }
  )
  const res = await resp.json()
  return res.success
}
export async function linkUser(user: User, xfUsername: string) {
  if (user.xenforoUsername) {
    // remove existing groups
    let removed = await removeGroups(user.xenforoUsername)
    if (!removed) return false
  }
  user.xenforoUsername = xfUsername
  await user.save()
  const foundUser = await getUserByUsername(xfUsername)
  if (!foundUser) {
    return false
  }

  const xfUser = foundUser as XfUser
  let newGroups = [parseInt(process.env.XF_GROUP_MEMBER!)]
  if (user.domainDonor) {
    newGroups.push(parseInt(process.env.XF_GROUP_DONOR!))
  }
  if (user.contributor) {
    newGroups.push(parseInt(process.env.XF_GROUP_CONTRIBUTOR!))
  }
  if (user.trusted) {
    newGroups.push(parseInt(process.env.XF_GROUP_TRUSTED!))
  }
  if (user.beta) {
    newGroups.push(parseInt(process.env.XF_GROUP_BETA!))
  }
  if (user.alpha) {
    newGroups.push(parseInt(process.env.XF_GROUP_ALPHA!))
  }
  if (xfUser.secondary_group_ids) {
    newGroups = newGroups.concat(xfUser.secondary_group_ids || [])
  }
  const resp = await fetch(
    `${process.env.XF_BASE}/api/users/${xfUser.user_id}`,
    {
      method: 'POST',
      headers: {
        'XF-Api-Key': process.env.XF_APIKEY!,
        'Content-Type': 'application/x-www-form-urlencoded',
        'XF-Api-User': '1'
      },
      body: querystring.stringify(
        {
          secondary_group_ids: newGroups
        },
        {
          arrayFormat: 'bracket'
        }
      )
    }
  )
  const res = await resp.json()
  return res.success
}

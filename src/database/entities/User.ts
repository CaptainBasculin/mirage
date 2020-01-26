import { Entity, Column, BaseEntity, PrimaryColumn, OneToMany } from 'typeorm'
import { Image } from './Image'
import { Invite } from './Invite'
import { ShortenedUrl } from './ShortenedUrl'

@Entity()
export class User extends BaseEntity {
  @PrimaryColumn()
  id: string

  @Column()
  username: string

  @Column()
  email: string

  @Column()
  emailVerificationToken: string

  @Column({ default: false })
  emailVerified: boolean

  @Column()
  password: string

  @Column({ default: false })
  passwordResetPending: boolean

  @Column()
  passwordResetToken: string

  @Column()
  uploadKey: string

  @Column({
    default: false
  })
  moderator: boolean

  @Column({
    default: false
  })
  admin: boolean

  @Column({
    default: false
  })
  suspended: boolean

  @Column({
    default: ''
  })
  suspensionReason: string

  @Column({
    default: false
  })
  longNames: boolean

  @Column({
    default: false
  })
  invisibleShortIds: boolean

  @Column({
    default: false
  })
  inviteCreator: boolean

  @Column({
    default: 0
  })
  availableInvites: number

  @OneToMany(
    type => Image,
    image => image.uploader
  )
  images: Image[]

  @OneToMany(
    type => Invite,
    invite => invite.creator
  )
  invites: Invite[]

  @OneToMany(
    type => ShortenedUrl,
    url => url.creator
  )
  urls: ShortenedUrl[]

  @Column({
    nullable: true
  })
  discord: string

  serialize() {
    return {
      id: this.id,
      username: this.username,
      email: this.email,
      uploadKey: this.uploadKey,
      moderator: this.moderator,
      admin: this.admin,
      longNames: this.longNames,
      images: this.images
        ? this.images.map(image => image.userSerialize())
        : [],
      invites: this.invites
        ? this.invites.map(invite => invite.serialize())
        : [],
      urls: this.urls ? this.urls.map(url => url.userSerialize()) : [],
      suspended: this.suspended,
      suspensionReason: this.suspensionReason,
      discord: this.discord,
      inviteCreator: this.inviteCreator,
      availableInvites: this.availableInvites,
      invisibleShortIds: this.invisibleShortIds
    }
  }
}

declare global {
  namespace Express {
    interface Request {
      user: User
      loggedIn: boolean
    }
  }
}

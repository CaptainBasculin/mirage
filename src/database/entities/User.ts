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
  longNames: boolean

  @OneToMany(type => Image, image => image.uploader)
  images: Image[]

  @OneToMany(type => Invite, invite => invite.creator)
  invites: Invite[]

  @OneToMany(type => ShortenedUrl, url => url.creator)
  urls: ShortenedUrl[]

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
      urls: this.urls ? this.urls.map(url => url.safeSerialize()) : []
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

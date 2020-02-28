import { Entity, Column, BaseEntity, PrimaryColumn, OneToMany } from 'typeorm'
import { Image } from './Image'
import { Invite } from './Invite'
import { ShortenedUrl } from './ShortenedUrl'
import { Domain } from './Domain'

@Entity()
export class User extends BaseEntity {
  @PrimaryColumn()
  id: string

  @Column()
  username: string

  @Column()
  lowercaseUsername: string

  @Column()
  email: string

  @Column()
  lowercaseEmail: string

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

  @OneToMany(
    type => Domain,
    domain => domain.donor
  )
  donatedDomains: Domain[]

  @Column({
    nullable: true
  })
  discord: string

  @Column({
    default: false
  })
  mfa_enabled: boolean

  @Column({
    default: false
  })
  mfa_totp_enabled: boolean

  @Column({
    nullable: true
  })
  mfa_totp_secret?: string

  @Column({
    nullable: true
  })
  mfa_recovery_code?: string

  @Column({
    default: false
  })
  inviteBanned: boolean

  @Column({
    default: false
  })
  domainDonor: boolean

  @Column({
    default: false
  })
  alpha: boolean

  @Column({
    default: false
  })
  beta: boolean

  @Column({
    default: false
  })
  trusted: boolean

  @Column({
    default: false
  })
  contributor: boolean

  @Column('varchar', { array: true, default: '{}' })
  randomDomains: string[]

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
      invisibleShortIds: this.invisibleShortIds,
      mfa_enabled: this.mfa_enabled,
      mfa_totp_enabled: this.mfa_totp_enabled,
      inviteBanned: this.inviteBanned,
      domainDonor: this.domainDonor,
      alpha: this.alpha,
      beta: this.beta,
      trusted: this.trusted,
      contributor: this.contributor,
      randomDomains: this.randomDomains
    }
  }
}

declare global {
  namespace Express {
    interface Request {
      user: User
      loggedIn: boolean
      flash: (clazz: string, message: string) => void
    }
  }
  namespace SocketIO {
    interface Socket {
      user: User
      loggedIn: boolean
    }
  }
}

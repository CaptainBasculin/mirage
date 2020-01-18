import { Entity, Column, BaseEntity, PrimaryColumn, ManyToOne } from 'typeorm'
import { User } from './User'

@Entity()
export class Invite extends BaseEntity {
  @PrimaryColumn()
  id: string

  @Column()
  invite: string

  @ManyToOne(
    type => User,
    user => user.invites
  )
  creator: User

  @Column({
    default: false
  })
  redeemed: boolean

  @Column({
    nullable: true
  })
  redeemedBy: string

  @Column()
  createdOn: Date

  serialize() {
    return {
      id: this.id,
      invite: this.invite,
      redeemed: this.redeemed,
      createdOn: this.createdOn,
      redeemedBy: this.redeemedBy
    }
  }
  adminSerialize() {
    return {
      id: this.id,
      invite: this.invite,
      redeemed: this.redeemed,
      createdOn: this.createdOn,
      redeemedBy: this.redeemedBy,
      creator: {
        id: this.creator.id,
        username: this.creator.username,
        email: this.creator.email
      }
    }
  }
}

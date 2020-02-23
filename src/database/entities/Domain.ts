import { Entity, Column, BaseEntity, PrimaryColumn, ManyToOne } from 'typeorm'
import { User } from './User'

@Entity()
export class Domain extends BaseEntity {
  @PrimaryColumn()
  id: string

  @Column()
  domain: string

  @Column({
    default: true
  })
  public: boolean

  @Column({
    default: false
  })
  editable: boolean

  @Column({
    default: true
  })
  wildcard: boolean

  @ManyToOne(
    type => User,
    user => user.urls
  )
  donor?: User

  serialize() {
    return {
      id: this.id,
      domain: this.domain,
      public: this.public,
      wildcard: this.wildcard,
      editable: this.editable,
      donor: this.donor
    }
  }
  apiSerialize() {
    return {
      id: this.id,
      domain: this.domain,
      public: this.public,
      wildcard: this.wildcard
    }
  }
}

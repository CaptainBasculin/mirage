import { Entity, Column, BaseEntity, PrimaryColumn } from 'typeorm'

@Entity()
export class Banner extends BaseEntity {
  @PrimaryColumn()
  id: string

  @Column()
  class: string

  @Column()
  message: string

  @Column({
    default: true
  })
  enabled: boolean

  serialize() {
    return {
      id: this.id,
      class: this.class,
      message: this.message,
      enabled: this.enabled
    }
  }
}

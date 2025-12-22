import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
} from "typeorm";
import { Month } from "./Month";
import { Day } from "./Day";

@Entity()
export class Week {
  @PrimaryGeneratedColumn("uuid")
  uuid!: string;

  @Column()
  name!: string;

  @Column({ default: "" })
  subtitle!: string;

  @Column({ default: 0 })
  progress!: number;

  @Column({ default: false })
  conquered!: boolean;

  @Column("text", { array: true, default: () => "ARRAY[]::text[]" })
  backgroundImages!: string[];

  @ManyToOne(() => Month, (month) => month.weeks)
  month!: Month;

  @OneToMany(() => Day, (day) => day.week, { cascade: true })
  days!: Day[];
}

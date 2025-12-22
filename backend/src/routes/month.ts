import { Router } from "express";
import { AppDataSource } from "../../ormconfig";
import { Month } from "../entity/Month";
import { Week } from "../entity/Week";
import { Day } from "../entity/Day";

const router = Router();

// Create a new month with default weeks and days
router.post("/", async (req, res) => {
  try {
    const { name, subtitle = "", progress = 0 } = req.body || {};
    const monthRepo = AppDataSource.getRepository(Month);
    const weekRepo = AppDataSource.getRepository(Week);
    const dayRepo = AppDataSource.getRepository(Day);

    // 1. Create & persist month first (no heavy nested graph in memory)
    const month = await monthRepo.save(
      monthRepo.create({ name, subtitle, progress })
    );

    // 2. Create weeks (store minimal objects, avoid populating back-reference arrays)
    const weeks: Week[] = [];
    for (let i = 1; i <= 4; i++) {
      const weekEntity = weekRepo.create({
        name: `Week ${i}`,
        subtitle: "",
        progress: 0,
        conquered: false,
        backgroundImages: [],
        month, // reference only
      });
      weeks.push(weekEntity);
    }
    await weekRepo.save(weeks);

    // 3. Create days for each week
    const allDays: Day[] = [];
    for (const w of weeks) {
      for (let j = 1; j <= 7; j++) {
        allDays.push(
          dayRepo.create({
            name: `Day ${j}`,
            subtitle: "",
            week: w,
          })
        );
      }
    }
    await dayRepo.save(allDays);

    // 4. Re-load month with relations to return a clean snapshot
    const fullMonth = await monthRepo.findOne({
      where: { uuid: month.uuid },
      relations: ["weeks", "weeks.days"],
      order: { weeks: { name: "ASC" } as any },
    });

    // 5. Sanitize to avoid circular references (strip parent pointers)
    const sanitized = fullMonth
      ? {
          uuid: fullMonth.uuid,
          name: fullMonth.name,
          subtitle: fullMonth.subtitle,
          progress: fullMonth.progress,
          weeks: (fullMonth.weeks || []).map((w) => ({
            uuid: w.uuid,
            name: w.name,
            subtitle: w.subtitle,
            progress: w.progress,
            conquered: w.conquered,
            backgroundImages: w.backgroundImages,
            days: (w.days || []).map((d) => ({
              uuid: d.uuid,
              name: d.name,
              subtitle: d.subtitle,
              tasks: [], // tasks empty on creation
            })),
          })),
        }
      : month; // fallback (shouldn't happen)

    res.status(201).json(sanitized);
  } catch (err) {
    const logger = require("../middleware/errorHandler").default;
    logger.error({
      message:
        typeof err === "object" && err !== null && "message" in err
          ? (err as any).message
          : "Unknown error occurred",
      stack:
        typeof err === "object" && err !== null && "stack" in err
          ? (err as any).stack
          : "No stack trace available",
      url: req.originalUrl,
      method: req.method,
      status: 500,
    });
    const errorMessage = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMessage });
  }
});

// Get all months with nested weeks/days/tasks
router.get("/", async (req, res) => {
  try {
    const monthRepo = AppDataSource.getRepository(Month);
    const months = await monthRepo.find({
      relations: ["weeks", "weeks.days", "weeks.days.tasks"],
    });
    res.json(months);
  } catch (err) {
    const logger = require("../middleware/errorHandler").default;
    logger.error({
      message:
        typeof err === "object" && err !== null && "message" in err
          ? (err as any).message
          : "Unknown error occurred",
      stack:
        typeof err === "object" && err !== null && "stack" in err
          ? (err as any).stack
          : "No stack trace available",
      url: req.originalUrl,
      method: req.method,
      status: 500,
    });
    const errorMessage = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMessage });
  }
});

export default router;

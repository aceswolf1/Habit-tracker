import { Router } from "express";
import { AppDataSource } from "../../ormconfig";
import { Task } from "../entity/Task";
import { Day } from "../entity/Day";

const router = Router();

// Add a task to a day
router.post("/:dayUuid", async (req, res) => {
  try {
    const { dayUuid } = req.params;
    const { description, optional, completed, order, recurrenceId } = req.body;
    const dayRepo = AppDataSource.getRepository(Day);
    const taskRepo = AppDataSource.getRepository(Task);

    const day = await dayRepo.findOne({
      where: { uuid: dayUuid },
      relations: ["tasks"],
    });
    if (!day) return res.status(404).json({ error: "Day not found" });

    const task = taskRepo.create({
      description,
      optional,
      completed,
      order,
      recurrenceId,
      day,
    });
    day.tasks.push(task);
    await taskRepo.save(task);
    await dayRepo.save(day);
    res.status(201).json(task);
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

// Update a task
router.put("/:taskUuid", async (req, res) => {
  try {
    const { taskUuid } = req.params;
    const updates = req.body;
    const taskRepo = AppDataSource.getRepository(Task);
    const task = await taskRepo.findOne({ where: { uuid: taskUuid } });
    if (!task) return res.status(404).json({ error: "Task not found" });
    Object.assign(task, updates);
    await taskRepo.save(task);
    res.json(task);
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

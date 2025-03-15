import bodyParser from "body-parser";
import express, { Request, Response } from "express";
import { BASE_USER_PORT } from "../config";

export type SendMessageBody = {
  message: string;
  destinationUserId: number;
};

export async function user(userId: number) {
  const _user = express();
  _user.use(express.json());
  _user.use(bodyParser.json());

  // Store last received and last sent messages (default: null)
  let lastReceivedMessage: string | null = null;
  let lastSentMessage: string | null = null;

  // Status route
  _user.get("/status", (req: Request, res: Response) => {
    res.send("live");
  });

  // GET last received message
  _user.get("/getLastReceivedMessage", (req: Request, res: Response) => {
    res.json({ result: lastReceivedMessage });
  });

  // GET last sent message
  _user.get("/getLastSentMessage", (req: Request, res: Response) => {
    res.json({ result: lastSentMessage });
  });

  _user.post("/message", (req: Request, res: Response) => {
    const { message } = req.body as SendMessageBody;

    if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Invalid message" });
    }

    lastReceivedMessage = message;
    return res.send("success"); // ✅ Explicitly returning ensures all paths return a value
  });

  const server = _user.listen(BASE_USER_PORT + userId, () => {
    console.log(`User ${userId} is listening on port ${BASE_USER_PORT + userId}`);
  });

  return server;
}

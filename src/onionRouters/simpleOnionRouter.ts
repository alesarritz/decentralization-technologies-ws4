import bodyParser from "body-parser";
import express, { Request, Response } from "express";
import { BASE_ONION_ROUTER_PORT, REGISTRY_PORT } from "../config";
import { generateRsaKeyPair, exportPubKey, exportPrvKey } from "../crypto";
import { webcrypto } from "node:crypto";

type CK = webcrypto.CryptoKey;

export async function simpleOnionRouter(nodeId: number) {
  const onionRouter = express();
  onionRouter.use(express.json());
  onionRouter.use(bodyParser.json());

  let privateKey: CK;
  let publicKey: CK;
  let privateKeyStr: string;
  let publicKeyStr: string;

  // Store the last received messages and destination (default: null)
  let lastReceivedEncryptedMessage: string | null = null;
  let lastReceivedDecryptedMessage: string | null = null;
  let lastMessageDestination: number | null = null;

  try {
    const keyPair = await generateRsaKeyPair();
    privateKey = keyPair.privateKey;
    publicKey = keyPair.publicKey;

    // Convert keys to base64
    publicKeyStr = await exportPubKey(publicKey);
    privateKeyStr = await exportPrvKey(privateKey);

    // Register with the registry
    const response = await fetch(`http://localhost:${REGISTRY_PORT}/registerNode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeId, pubKey: publicKeyStr }),
    });

    if (!response.ok) {
      throw new Error(`Failed to register node ${nodeId}`);
    }

    console.log(`Node ${nodeId} registered successfully`);
  } catch (error) {
    console.error("Failed to initialize node:", error);
    throw error;
  }

  // Status route
  onionRouter.get("/status", (req: Request, res: Response) => {
    res.send("live");
  });

  // GET last received encrypted message
  onionRouter.get("/getLastReceivedEncryptedMessage", (req: Request, res: Response) => {
    res.json({ result: lastReceivedEncryptedMessage });
  });

  // GET last received decrypted message
  onionRouter.get("/getLastReceivedDecryptedMessage", (req: Request, res: Response) => {
    res.json({ result: lastReceivedDecryptedMessage });
  });

  // GET last message destination
  onionRouter.get("/getLastMessageDestination", (req: Request, res: Response) => {
    res.json({ result: lastMessageDestination });
  });

  // Provide private key for testing purposes
  onionRouter.get("/getPrivateKey", (req: Request, res: Response) => {
    res.json({ result: privateKeyStr });
  });

  const server = onionRouter.listen(BASE_ONION_ROUTER_PORT + nodeId, () => {
    console.log(`Onion router ${nodeId} is listening on port ${BASE_ONION_ROUTER_PORT + nodeId}`);
  });

  return server;
}

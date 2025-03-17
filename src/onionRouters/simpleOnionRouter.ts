import bodyParser from "body-parser";
import express from "express";
import { BASE_ONION_ROUTER_PORT, REGISTRY_PORT, BASE_USER_PORT } from "../config";
import {
  generateRsaKeyPair,
  rsaDecrypt,
  symDecrypt,
  importSymKey,
  exportPubKey,
  exportPrvKey,
  exportSymKey,
} from "../crypto";
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
  let lastCircuit: number[] = [];
  let lastReceivedEncryptedMessage: string | null = null;
  let lastReceivedDecryptedMessage: string | null = null;
  let lastMessageDestination: number | null = null;

  try {
    const keyPair = await generateRsaKeyPair();
    privateKey = keyPair.privateKey;
    publicKey = keyPair.publicKey;
    publicKeyStr = await exportPubKey(publicKey);
    privateKeyStr = await exportPrvKey(privateKey);

    const registryResponse = await fetch(`http://localhost:${REGISTRY_PORT}/registerNode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeId, pubKey: publicKeyStr }),
    });

    if (!registryResponse.ok) throw new Error(`Failed to register node: ${registryResponse.statusText}`);
    console.log(`Node ${nodeId} registered successfully`);
  } catch (error) {
    console.error("Failed to initialize node:", error);
    throw error;
  }

  onionRouter.get("/status", (req, res) => res.send("live"));
  onionRouter.get("/getLastReceivedEncryptedMessage", (req, res) => res.json({ result: lastReceivedEncryptedMessage }));
  onionRouter.get("/getLastReceivedDecryptedMessage", (req, res) => res.json({ result: lastReceivedDecryptedMessage }));
  onionRouter.get("/getLastMessageDestination", (req, res) => res.json({ result: lastMessageDestination }));
  onionRouter.get("/getPrivateKey", async (req, res) => res.json({ result: privateKeyStr }));
  onionRouter.get("/getLastCircuit", (req, res) => res.json({ result: lastCircuit }));

  onionRouter.post("/message", async (req, res) => {
    try {
      const { message, circuit = [] } = req.body;
      console.log(`Node ${nodeId} received message:`, message);
  
      if (!message) return res.status(400).json({ error: "Message required" });
  
      lastReceivedEncryptedMessage = message;
      console.log(`Last received encrypted message on Node ${nodeId}:`, lastReceivedEncryptedMessage);

      const encryptedSymKey = message.slice(0, 344);
      const encryptedPayload = message.slice(344);

      let symKey;
      try {
        const symKeyStr = await rsaDecrypt(encryptedSymKey, privateKey);
        symKey = await importSymKey(symKeyStr);
      } catch (error) {
        console.error(`Node ${nodeId} failed to decrypt symmetric key:`, error);
        return res.status(500).json({ error: "Symmetric key decryption failed" });
      }

      let decryptedPayload;
      try {
        decryptedPayload = await symDecrypt(await exportSymKey(symKey), encryptedPayload);
      } catch (error) {
        console.error(`Node ${nodeId} failed to decrypt payload:`, error);
        return res.status(500).json({ error: "Payload decryption failed" });
      }

      const destination = parseInt(decryptedPayload.slice(0, 10), 10);
      const remainingMessage = decryptedPayload.length > 10 ? decryptedPayload.substring(10) : "";

      lastReceivedDecryptedMessage = remainingMessage;
      lastMessageDestination = destination;
      lastCircuit = [...circuit, nodeId];

      await fetch(`http://localhost:${destination}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: remainingMessage, circuit: lastCircuit }),
      });

      return res.json({ success: true });
    } catch (error) {
      console.error("Error processing message:", error);
      return res.status(500).json({ error: "Failed to process message" });
    }
  });

  return onionRouter.listen(BASE_ONION_ROUTER_PORT + nodeId, () =>
    console.log(`Onion router ${nodeId} is listening on port ${BASE_ONION_ROUTER_PORT + nodeId}`)
  );
}

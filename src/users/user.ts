import bodyParser from "body-parser";
import express from "express";
import { BASE_USER_PORT, REGISTRY_PORT, BASE_ONION_ROUTER_PORT } from "../config";
import { symEncrypt, rsaEncrypt, exportSymKey, importPubKey, createRandomSymmetricKey, exportPubKey } from "../crypto";
interface RegistryResponse {
  nodes: Array<{ nodeId: number; pubKey: string }>;
}

let lastReceivedMessage: string | null = null;
let lastSentMessage: string | null = null;

export async function user(userId: number) {
  let lastCircuit: number[] = [];
  const _user = express();
  _user.use(express.json());
  _user.use(bodyParser.json());

  _user.get("/status", (req, res) => res.send("live"));
  _user.get("/getLastReceivedMessage", (req, res) => res.json({ result: lastReceivedMessage }));
  _user.get("/getLastSentMessage", (req, res) => res.json({ result: lastSentMessage }));
  _user.get("/getLastCircuit", (req, res) => res.json({ result: lastCircuit }));

  _user.post("/message", (req, res) => {
    const { message, circuit } = req.body;
    if (!message) return res.status(400).json({ error: "Message required." });

    lastReceivedMessage = message === undefined ? "" : message;
    if (circuit) lastCircuit = circuit;

    return res.send("success");
  });

  _user.post("/sendMessage", async (req, res) => {
    const { message, destinationUserId } = req.body;
    try {
      const registryResponse = await fetch(`http://localhost:${REGISTRY_PORT}/getNodeRegistry`);
      const { nodes } = await registryResponse.json() as RegistryResponse;

      if (nodes.length < 3) return res.status(500).json({ error: "Not enough nodes available" });

      const selectedNodes = selectRandomNodes(nodes, 3);
      const circuit = selectedNodes.map(node => node.nodeId);
      let finalDestination = `${BASE_USER_PORT + destinationUserId}`.padStart(10, "0");

      let encryptedMessage = message;
      for (let i = circuit.length - 1; i >= 0; i--) {
        const symKey = await createRandomSymmetricKey();
        const symKeyStr = await exportSymKey(symKey);
        const nodePublicKey = await importPubKey(selectedNodes[i].pubKey);

        const encryptedSymKey = await rsaEncrypt(symKeyStr, await exportPubKey(nodePublicKey));
        const payload = finalDestination + encryptedMessage;
        const encryptedPayload = await symEncrypt(symKey, payload);

        encryptedMessage = encryptedSymKey + encryptedPayload;
        finalDestination = `${BASE_ONION_ROUTER_PORT + circuit[i]}`.padStart(10, "0");
      }

      await fetch(`http://localhost:${BASE_ONION_ROUTER_PORT + circuit[0]}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: encryptedMessage, circuit: [] }),
      }).then(response => response.text()).then(data => console.log("Message sent response:", data));
      

      lastSentMessage = message;
      lastCircuit = circuit;
      return res.json({ success: true });
    } catch (error) {
      console.error("Error sending message:", error);
      return res.status(500).json({ error: "Failed to send message" });
    }
  });

  const server = _user.listen(BASE_USER_PORT + userId, () =>
    console.log(`User ${userId} is listening on port ${BASE_USER_PORT + userId}`)
  );

  return server;
}

function selectRandomNodes(nodes: Array<{ nodeId: number; pubKey: string }>, count: number) {
  return nodes.sort(() => Math.random() - 0.5).slice(0, count);
}

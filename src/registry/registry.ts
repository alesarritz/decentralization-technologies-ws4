import bodyParser from "body-parser";
import express, { Request, Response } from "express";
import { REGISTRY_PORT } from "../config";

export type Node = { nodeId: number; pubKey: string };
const nodes: Node[] = [];

export type RegisterNodeBody = {
  nodeId: number;
  pubKey: string;
};

export type GetNodeRegistryBody = {
  nodes: Node[];
};

export async function launchRegistry() {
  const _registry = express();
  _registry.use(express.json());
  _registry.use(bodyParser.json());

  // Status route
  _registry.get("/status", (req: Request, res: Response) => {
    res.send("live");
  });

  _registry.post("/registerNode", (req: Request, res: Response) => {
    const { nodeId, pubKey } = req.body as RegisterNodeBody;

    if (typeof nodeId !== "number" || typeof pubKey !== "string") {
      return res.status(400).json({ error: "Invalid request body" });
    }

    // Check if the node already exists
    const existingNode = nodes.find((n) => n.nodeId === nodeId);
    if (existingNode) {
      existingNode.pubKey = pubKey;
    } else {
      nodes.push({ nodeId, pubKey });
    }

    res.status(200).json({ success: true });
    return res.status(200).json({ success: true });
  });

  // Implement /getNodeRegistry to return the list of registered nodes
  _registry.get("/getNodeRegistry", (req: Request, res: Response) => {
    res.json({ nodes });
  });


  const server = _registry.listen(REGISTRY_PORT, () => {
    console.log(`registry is listening on port ${REGISTRY_PORT}`);
  });

  return server;
}

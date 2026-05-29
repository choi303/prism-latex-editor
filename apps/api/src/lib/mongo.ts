import mongoose from "mongoose";

let connectionPromise: Promise<typeof mongoose> | null = null;

export function connectMongo(uri: string) {
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(uri, {
      autoIndex: true,
    } as any);
  }

  return connectionPromise;
}

import { Schema, model, models } from "mongoose";

const fileSchema = new Schema(
  {
    ownerRef: {
      type: String,
      default: null,
      index: true
    },
    filename: {
      type: String,
      required: true,
      trim: true
    },
    mimeType: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    storageKey: {
      type: String,
      required: true
    },
    extractionStatus: {
      type: String,
      enum: ["queued", "processing", "ready", "failed"],
      default: "queued"
    },
    extractedTextPreview: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

export const FileModel = models.File || model("File", fileSchema);
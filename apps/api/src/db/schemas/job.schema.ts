import { Schema, model, models } from "mongoose";

const jobSchema = new Schema(
  {
    kind: {
      type: String,
      enum: ["file_ingest", "file_extract", "usage_reconcile"],
      required: true
    },
    status: {
      type: String,
      enum: ["queued", "running", "done", "failed"],
      default: "queued"
    },
    payload: {
      type: Schema.Types.Mixed,
      default: {}
    },
    errorMessage: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

export const JobModel = models.Job || model("Job", jobSchema);
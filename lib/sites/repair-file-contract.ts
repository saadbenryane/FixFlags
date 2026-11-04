import { z } from 'zod'
import { repairBriefSchema, repairContextHashSchema } from './repair-brief-contract'
import { repairScopeSchema, MAX_REPAIR_MANIFEST_TASKS } from './repair-scope'

export const repairFileRequestSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('flag'), flagId: z.string().min(1).max(200), expectedPromptHash: repairContextHashSchema }).strict(),
  repairScopeSchema.extend({ kind: z.literal('bundle'), manifestHash: repairContextHashSchema }).strict(),
])
export type RepairFileRequest = z.infer<typeof repairFileRequestSchema>
export const REPAIR_FILE_TIMEOUT_MS = 120_000

/** The same public task, with its complete observation array instead of a
 * transport page. References identify private originals without granting access. */
export const repairFileTaskSchema = repairBriefSchema.omit({ schemaVersion: true, observationPage: true, links: true, retrieval: true }).extend({
  flag: repairBriefSchema.shape.flag.extend({ supportingObservations:
    repairBriefSchema.shape.flag.shape.supportingObservations.unwrap().element.array().max(5000).nullable() }),
  references: repairBriefSchema.shape.links.pick({ flag: true, report: true, evidence: true }),
}).strict()
export type RepairFileTask = z.infer<typeof repairFileTaskSchema>

export const repairFileHeaderSchema = z.object({
  schemaVersion: z.literal('fixflags.repair-file.v1'), siteId: z.string().min(1),
  scope: repairFileRequestSchema, instructions: z.array(z.string()),
}).strict()

export const repairFileCompletionSchema = z.object({ taskCount: z.number().int().positive().max(MAX_REPAIR_MANIFEST_TASKS),
  taskArraySha256: repairContextHashSchema, complete: z.literal(true) }).strict()

export const repairFileSchema = repairFileHeaderSchema.extend({
  tasks: z.array(repairFileTaskSchema).min(1).max(MAX_REPAIR_MANIFEST_TASKS),
  completion: repairFileCompletionSchema,
}).strict().refine(file => file.completion.taskCount === file.tasks.length, 'Incomplete repair file')

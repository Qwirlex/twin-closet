import type { JobInput, JobResult } from '@twin/shared'
import type { MetaApi } from '../meta'
import type { Store } from '../store'

/** Общее между шагами одной задачи: вход, то, что уже получилось, и черновик для следующих шагов */
export interface StepContext {
  meta: MetaApi
  store: Store
  jobId: string
  input: JobInput
  result: JobResult
  scratch: Record<string, unknown>
  /** скачивание демо-фото с сайта приложения (в тестах — подмена) */
  fetchImpl?: typeof fetch
}

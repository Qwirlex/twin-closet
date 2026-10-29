import type { JobErrorCode } from '@twin/shared'

/** Ошибка задачи с кодом для приложения: no_key — ждём ключ Meta, bad_input — вина входа, model — модель не справилась */
export class JobError extends Error {
  constructor(
    readonly code: JobErrorCode,
    message: string
  ) {
    super(message)
  }
}

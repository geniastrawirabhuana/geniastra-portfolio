import { revalidatePath, revalidateTag } from 'next/cache'
import { publicProjectRevalidationPaths } from './public-project-paths'

export function revalidatePublicProjects(...slugs: string[]) {
  revalidateTag('public-projects', { expire: 0 })
  for (const path of publicProjectRevalidationPaths(...slugs)) revalidatePath(path)
}

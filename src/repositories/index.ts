import { httpRepository } from './httpRepository';
import { mockRepository } from './mockRepository';
import { isPreviewMode } from '../config/preview';

export const repository = isPreviewMode() ? mockRepository : httpRepository;
export { httpRepository } from './httpRepository';
export { mockRepository } from './mockRepository';
export type * from './types';

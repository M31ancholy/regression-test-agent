import type { Page } from 'playwright';
import { v4 as uuidv4 } from 'uuid';
import type { TodoTestItem } from './types.js';

export type johnAgentOptions = {
    // agent 需要测试的网址
    readyToTestURL:string
    //使用readyTotestURL 创建的实例
    page: Page
    runId:string
    // 传入的具体回归测试步骤
    todos: TodoTestItem[]
    referenceScreenshots: ReadonlyMap<number, Uint8Array>
}

export function createRunId(): string {
    return uuidv4();
}

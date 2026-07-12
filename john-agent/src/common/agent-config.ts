import { Page } from 'playwright';
import { v4 as uuidv4 } from 'uuid';

export type johnAgentOptions = {
    // agent 需要测试的网址
    readyToTestURL:string
    //使用readyTotestURL 创建的实例
    page: Page
    runId:string

}

export function createRunId(): string {
    return uuidv4();
}

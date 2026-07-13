import { OverallStepDesc } from "./types.js";

export type workFlowOptions = {
    // agent 需要测试的网址
    readyToTestURL:string
    // 用户录制步骤
    steps: OverallStepDesc;
    // 用户本次测试的使用的目标提示词，kennel不需要
    prompt:string
}

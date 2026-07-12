import { Agent } from "http";
import { workFlowOptions } from "../../common/workflow-config.js";
import { createCheckAgent } from "../../agents/check-agent.js";
import { createRunId, johnAgentOptions } from "../../common/agent-config.js";
import { v4 as uuidv4, v4 } from 'uuid';
// 一次待启动的测试叫做workflow
function startWorkFlow(option :workFlowOptions){
    

    

    const agentOpt: johnAgentOptions = {
        readyToTestURL : option.readyToTestURL,
        runId: createRunId(),
    }

    const john = createCheckAgent(agentOpt)

    


}

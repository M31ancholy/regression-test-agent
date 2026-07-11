package model

// 输入Step结构
type stepRecord struct {
	singleRecord []singleStepRecord
}

// 单步录制的消息结构
type singleStepRecord struct {
	stepDesc            string
	afterStepScreenShot string
}

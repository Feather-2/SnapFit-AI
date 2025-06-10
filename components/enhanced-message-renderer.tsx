"use client"

import React, { useState, useEffect, useMemo } from "react"
import { MarkdownRenderer } from "./markdown-renderer"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp, Brain, Edit3 } from "lucide-react"
import { cn } from "@/lib/utils"

interface EnhancedMessageRendererProps {
  content: string
  reasoningContent?: string
  className?: string
  isMobile?: boolean
  isStreaming?: boolean // 新增：是否正在流式传输
  isExportMode?: boolean // 新增：是否为导出模式
  onMemoryUpdateRequest?: (request: { newContent: string; reason: string }) => void // 记忆更新回调
}

const EnhancedMessageRenderer = React.memo(({
  content,
  reasoningContent,
  className,
  isMobile = false,
  isStreaming = false,
  isExportMode = false,
  onMemoryUpdateRequest
}: EnhancedMessageRendererProps) => {
  // 根据导出模式和内容类型设置默认展开状态
  const [showReasoning, setShowReasoning] = useState(() => {
    if (isExportMode) {
      // 导出模式下：如果有思考过程，默认展开
      return !!(content.includes('<think>') || content.includes('[思考过程]') || reasoningContent)
    }
    return false
  })

  const [showMemoryRequest, setShowMemoryRequest] = useState(() => {
    if (isExportMode) {
      // 导出模式下：AI记忆更新请求默认不展开
      return false
    }
    return true // 正常模式下默认展开记忆更新请求
  })

  const [editableMemoryContent, setEditableMemoryContent] = useState("")
  const [editableMemoryReason, setEditableMemoryReason] = useState("")
  const [isEditing, setIsEditing] = useState(false)

  // 流式解析内容，实时提取思考过程、主要内容和记忆更新请求
  const parseStreamingContent = useMemo(() => {
    // 检查是否包含思考过程标记
    const thinkMatch = content.match(/<think>([\s\S]*?)(<\/think>|$)/i)
    const reasoningMatch = content.match(/\[思考过程\]([\s\S]*?)(\[\/思考过程\]|$)/i)
    const contentMatch = content.match(/\[回答\]([\s\S]*?)(\[\/回答\]|$)/i)

    // 检查是否包含记忆更新请求
    const memoryMatch = content.match(/\[MEMORY_UPDATE_REQUEST\]([\s\S]*?)(\[\/MEMORY_UPDATE_REQUEST\]|$)/i)
    const memoryContentMatch = content.match(/\[MEMORY_UPDATE_REQUEST\][\s\S]*?新记忆内容[：:]\s*([\s\S]*?)\s*更新原因[：:]\s*([\s\S]*?)\s*\[\/MEMORY_UPDATE_REQUEST\]/i)

    let reasoning = ""
    let mainContent = content
    let hasCompleteReasoning = false
    let hasCompleteContent = false
    let memoryRequest = null
    let hasCompleteMemoryRequest = false
    let contentBeforeMemory = ""
    let contentAfterMemory = ""

    // 处理记忆更新请求
    if (memoryMatch) {
      hasCompleteMemoryRequest = content.includes("[/MEMORY_UPDATE_REQUEST]")

      // 尝试解析记忆内容，无论是否完成
      if (memoryContentMatch) {
        const [, newContent, reason] = memoryContentMatch
        memoryRequest = {
          newContent: newContent?.trim() || "",
          reason: reason?.trim() || ""
        }
      } else {
        // 如果没有找到完整的记忆内容格式，尝试提取部分内容
        const partialContentMatch = content.match(/\[MEMORY_UPDATE_REQUEST\]([\s\S]*?)(?:\[\/MEMORY_UPDATE_REQUEST\]|$)/i)
        if (partialContentMatch) {
          const partialContent = partialContentMatch[1].trim()
          // 尝试提取新内容和原因的部分信息
          const newContentMatch = partialContent.match(/新内容[：:]\s*([\s\S]*?)(?=\n原因[：:]|$)/i)
          const reasonMatch = partialContent.match(/原因[：:]\s*([\s\S]*?)$/i)

          memoryRequest = {
            newContent: newContentMatch ? newContentMatch[1].trim() : partialContent,
            reason: reasonMatch ? reasonMatch[1].trim() : ""
          }
        }
      }

      // 分割内容：记忆更新请求前后的内容
      const memoryStartIndex = content.indexOf("[MEMORY_UPDATE_REQUEST]")
      const memoryEndIndex = content.indexOf("[/MEMORY_UPDATE_REQUEST]")

      if (memoryStartIndex !== -1) {
        contentBeforeMemory = content.substring(0, memoryStartIndex).trim()
        if (memoryEndIndex !== -1) {
          contentAfterMemory = content.substring(memoryEndIndex + "[/MEMORY_UPDATE_REQUEST]".length).trim()
        }
      }

      // 如果没有找到结束标记，说明还在流式传输中
      if (memoryEndIndex === -1 && memoryStartIndex !== -1) {
        contentBeforeMemory = content.substring(0, memoryStartIndex).trim()
        contentAfterMemory = ""
      }

      // 从分割的内容中移除思考过程标记
      contentBeforeMemory = contentBeforeMemory.replace(/<think>[\s\S]*?(<\/think>|$)/i, "").trim()
      contentAfterMemory = contentAfterMemory.replace(/<think>[\s\S]*?(<\/think>|$)/i, "").trim()
    }

    // 处理 <think> 标签格式（DeepSeek等模型）
    if (thinkMatch) {
      reasoning = thinkMatch[1].trim()
      hasCompleteReasoning = content.includes("</think>")

      // 移除思考过程，获取主要内容
      mainContent = mainContent.replace(/<think>[\s\S]*?(<\/think>|$)/i, "").trim()
    }
    // 处理中文标记格式
    else if (reasoningMatch) {
      reasoning = reasoningMatch[1].trim()
      hasCompleteReasoning = content.includes("[/思考过程]")

      if (contentMatch) {
        mainContent = contentMatch[1].trim()
        hasCompleteContent = content.includes("[/回答]")
      } else {
        // 如果还没有回答部分，显示原始内容
        mainContent = mainContent.replace(/\[思考过程\][\s\S]*?(\[\/思考过程\]|$)/i, "").trim()
      }
    }
    // 处理JSON格式
    else {
      try {
        const parsed = JSON.parse(content)
        if (parsed.reasoning_content && parsed.content) {
          reasoning = parsed.reasoning_content
          mainContent = parsed.content
          hasCompleteReasoning = true
          hasCompleteContent = true
        }
      } catch {
        // 不是JSON格式，保持原样
      }
    }

    return {
      reasoning: reasoning || reasoningContent || "",
      mainContent,
      hasCompleteReasoning,
      hasCompleteContent,
      hasReasoning: !!(reasoning || reasoningContent),
      memoryRequest,
      hasMemoryRequest: !!memoryMatch,
      hasCompleteMemoryRequest,
      contentBeforeMemory,
      contentAfterMemory
    }
  }, [content, reasoningContent])

  // 解析内容，检查是否包含reasoning_content和content字段（保留原有逻辑作为备用）
  const parseStructuredContent = (rawContent: string) => {
    try {
      // 尝试解析JSON格式的结构化内容
      const parsed = JSON.parse(rawContent)
      if (parsed.reasoning_content && parsed.content) {
        return {
          reasoning: parsed.reasoning_content,
          main: parsed.content
        }
      }
    } catch {
      // 如果不是JSON，尝试解析特殊标记格式
      const reasoningMatch = rawContent.match(/\[REASONING\]([\s\S]*?)\[\/REASONING\]/i)
      const contentMatch = rawContent.match(/\[CONTENT\]([\s\S]*?)\[\/CONTENT\]/i)

      if (reasoningMatch && contentMatch) {
        return {
          reasoning: reasoningMatch[1].trim(),
          main: contentMatch[1].trim()
        }
      }

      // 检查是否有思考过程标记
      const thinkingMatch = rawContent.match(/\[思考过程\]([\s\S]*?)\[\/思考过程\]/i)
      const answerMatch = rawContent.match(/\[回答\]([\s\S]*?)\[\/回答\]/i)

      if (thinkingMatch && answerMatch) {
        return {
          reasoning: thinkingMatch[1].trim(),
          main: answerMatch[1].trim()
        }
      }
    }

    return null
  }

  // 使用流式解析的结果
  const {
    reasoning,
    mainContent,
    hasReasoning,
    hasCompleteReasoning,
    memoryRequest,
    hasMemoryRequest,
    hasCompleteMemoryRequest,
    contentBeforeMemory,
    contentAfterMemory
  } = parseStreamingContent

  // 当有记忆请求时，设置可编辑内容（无论是否完成）
  useEffect(() => {
    if (memoryRequest) {
      // 确保内容不为空且有效
      const content = memoryRequest.newContent?.trim() || ""
      const reason = memoryRequest.reason?.trim() || ""

      // 只有当内容发生变化时才更新，避免覆盖用户的编辑
      if (content !== editableMemoryContent || reason !== editableMemoryReason) {
        setEditableMemoryContent(content)
        setEditableMemoryReason(reason)
      }
    }
  }, [memoryRequest])

  // 验证记忆内容是否有效
  const isMemoryContentValid = editableMemoryContent.trim().length > 0
  const hasSpecialChars = /[<>{}[\]\\|`~!@#$%^&*()+=]/.test(editableMemoryContent)
  const isContentTooLong = editableMemoryContent.length > 500
  const isReasonTooLong = editableMemoryReason.length > 200

  // 渲染记忆更新请求组件
  const renderMemoryUpdateRequest = () => {
    if (!hasMemoryRequest) return null

    return (
      <div className="border border-blue-200 dark:border-blue-800 rounded-xl overflow-hidden shadow-sm bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 my-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowMemoryRequest(!showMemoryRequest)}
          className={cn(
            "w-full justify-between h-auto bg-transparent hover:bg-blue-100/50 dark:hover:bg-blue-900/20 border-0 rounded-none",
            isMobile ? "p-3 text-xs" : "p-4 text-sm"
          )}
        >
          <div className={cn("flex items-center", isMobile ? "space-x-2" : "space-x-3")}>
            <div className={cn("bg-blue-100 dark:bg-blue-900/40 rounded-lg", isMobile ? "p-1.5" : "p-2")}>
              <Brain className={cn("text-blue-600 dark:text-blue-400", isMobile ? "h-4 w-4" : "h-5 w-5")} />
            </div>
            <div className="text-left">
              <div className={cn("font-semibold text-blue-900 dark:text-blue-100", isMobile ? "text-sm" : "")}>
                {isStreaming && !hasCompleteMemoryRequest ? "🧠 AI正在整理记忆..." : "🧠 AI记忆更新请求"}
              </div>
              <div className={cn("text-blue-600 dark:text-blue-400 mt-0.5", isMobile ? "text-xs" : "text-xs")}>
                {isStreaming && !hasCompleteMemoryRequest ? "正在生成个性化记忆内容" : "点击查看并确认记忆更新"}
              </div>
            </div>
          </div>
          {showMemoryRequest ? (
            <ChevronUp className={cn("text-blue-600 dark:text-blue-400", isMobile ? "h-4 w-4" : "h-5 w-5")} />
          ) : (
            <ChevronDown className={cn("text-blue-600 dark:text-blue-400", isMobile ? "h-4 w-4" : "h-5 w-5")} />
          )}
        </Button>

        {showMemoryRequest && (
          <div className={cn(
            "bg-gradient-to-br from-blue-50/80 to-indigo-50/80 dark:from-blue-950/20 dark:to-indigo-950/20 border-t border-blue-200/50 dark:border-blue-800/50",
            isMobile ? "p-4" : "p-6"
          )}>
            {!hasCompleteMemoryRequest && isStreaming ? (
              // 流式渲染中的状态 - 只有在正在流式传输时才显示
              <div className={cn("space-y-4", isMobile ? "space-y-3" : "")}>
                <div className="flex items-center justify-center space-x-2 py-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                  <span className={cn("text-blue-600 dark:text-blue-400 font-medium ml-3", isMobile ? "text-sm" : "")}>AI正在整理记忆内容...</span>
                </div>
                {memoryRequest && (
                  <div className={cn(
                    "bg-white/70 dark:bg-blue-900/20 rounded-xl border border-blue-200/50 dark:border-blue-800/50 shadow-sm",
                    isMobile ? "p-3" : "p-4"
                  )}>
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center space-x-2 mb-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <span className={cn("font-semibold text-blue-800 dark:text-blue-200", isMobile ? "text-sm" : "text-sm")}>记忆内容</span>
                        </div>
                        <div className={cn(
                          "text-blue-700 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-900/30 rounded-lg",
                          isMobile ? "text-sm p-3" : "text-sm p-3"
                        )}>
                          {memoryRequest.newContent}
                        </div>
                      </div>
                      {memoryRequest.reason && (
                        <div>
                          <div className="flex items-center space-x-2 mb-2">
                            <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                            <span className={cn("font-semibold text-indigo-800 dark:text-indigo-200", isMobile ? "text-sm" : "text-sm")}>更新原因</span>
                          </div>
                          <div className={cn(
                            "text-indigo-700 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-900/30 rounded-lg",
                            isMobile ? "text-sm p-3" : "text-sm p-3"
                          )}>
                            {memoryRequest.reason}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // 完成状态或非流式状态，精炼的确认界面
              <div className="space-y-3">
                {!isEditing ? (
                  // 只读模式 - 精简卡片设计
                  <div className="space-y-2">
                    <div className={cn(
                      "bg-white/70 dark:bg-blue-900/20 rounded-lg border border-blue-200/50 dark:border-blue-800/50",
                      isMobile ? "p-3" : "p-2.5"
                    )}>
                      {isMobile ? (
                        // 移动端：垂直布局
                        <div className="space-y-3">
                          {/* 记忆内容 */}
                          <div>
                            <div className="flex items-center space-x-2 mb-2">
                              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                              <span className="text-xs font-medium text-blue-800 dark:text-blue-200">记忆内容</span>
                            </div>
                            <div className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed bg-blue-50/50 dark:bg-blue-900/30 p-3 rounded-lg">
                              {editableMemoryContent}
                            </div>
                          </div>

                          {/* 更新原因 */}
                          {editableMemoryReason && (
                            <div>
                              <div className="flex items-center space-x-2 mb-2">
                                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
                                <span className="text-xs font-medium text-indigo-800 dark:text-indigo-200">更新原因</span>
                              </div>
                              <div className="text-sm text-indigo-700 dark:text-indigo-300 leading-relaxed bg-indigo-50/50 dark:bg-indigo-900/30 p-3 rounded-lg">
                                {editableMemoryReason}
                              </div>
                            </div>
                          )}

                          {/* 编辑按钮 */}
                          <div className="flex justify-end pt-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setIsEditing(true)}
                              className="p-2 h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                            >
                              <Edit3 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        // 桌面端：水平布局（保持原有逻辑）
                        <div className="flex items-start justify-between">
                          {/* 动态计算宽度比例 */}
                          {(() => {
                            const contentLength = editableMemoryContent.length
                            const reasonLength = editableMemoryReason?.length || 0
                            const totalLength = contentLength + reasonLength

                            // 如果没有更新原因，记忆内容占满整行
                            if (!editableMemoryReason) {
                              return (
                                <>
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-2 mb-1.5">
                                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                                      <span className="text-xs font-medium text-blue-800 dark:text-blue-200">记忆内容</span>
                                    </div>
                                    <div className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
                                      {editableMemoryContent}
                                    </div>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setIsEditing(true)}
                                    className="ml-2 p-1 h-6 w-6 text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                                  >
                                    <Edit3 className="h-3 w-3" />
                                  </Button>
                                </>
                              )
                            }

                            // 有更新原因时，计算宽度比例
                            let contentWidth, reasonWidth
                            if (totalLength === 0) {
                              contentWidth = "w-7/12"
                              reasonWidth = "w-3/12"
                            } else {
                              const ratio = Math.abs(contentLength - reasonLength) / totalLength
                              if (ratio < 0.3) {
                                // 字数相近，使用 5:5
                                contentWidth = "w-5/12"
                                reasonWidth = "w-5/12"
                              } else {
                                // 字数差异较大，使用 7:3
                                contentWidth = "w-7/12"
                                reasonWidth = "w-3/12"
                              }
                            }

                            return (
                              <>
                                <div className={`${contentWidth} pr-3`}>
                                  <div className="flex items-center space-x-2 mb-1.5">
                                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                                    <span className="text-xs font-medium text-blue-800 dark:text-blue-200">记忆内容</span>
                                  </div>
                                  <div className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
                                    {editableMemoryContent}
                                  </div>
                                </div>
                                <div className={`${reasonWidth} pl-3 border-l border-blue-200/50 dark:border-blue-700/50`}>
                                  <div className="flex items-center space-x-2 mb-1.5">
                                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
                                    <span className="text-xs font-medium text-indigo-800 dark:text-indigo-200">更新原因</span>
                                  </div>
                                  <div className="text-sm text-indigo-700 dark:text-indigo-300 leading-relaxed">
                                    {editableMemoryReason}
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setIsEditing(true)}
                                  className="ml-2 p-1 h-6 w-6 text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                                >
                                  <Edit3 className="h-3 w-3" />
                                </Button>
                              </>
                            )
                          })()}
                        </div>
                      )}
                    </div>

                    <div className={cn(
                      "flex pt-2",
                      isMobile ? "space-x-3" : "space-x-2"
                    )}>
                      <Button
                        size="sm"
                        onClick={() => {
                          if (onMemoryUpdateRequest && editableMemoryContent.trim()) {
                            onMemoryUpdateRequest({
                              newContent: editableMemoryContent.trim(),
                              reason: editableMemoryReason.trim()
                            })
                            setShowMemoryRequest(false)
                          }
                        }}
                        className={cn(
                          "flex-1 bg-blue-600 hover:bg-blue-700 text-white",
                          isMobile ? "text-sm py-2" : "text-xs py-1"
                        )}
                      >
                        ✓ 确认
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowMemoryRequest(false)}
                        className={cn(
                          "flex-1 border-blue-300 text-blue-700 hover:bg-blue-50",
                          isMobile ? "text-sm py-2" : "text-xs py-1"
                        )}
                      >
                        ✕ 取消
                      </Button>
                    </div>
                  </div>
                ) : (
                  // 编辑模式
                  <div className={cn("space-y-3", isMobile ? "space-y-4" : "")}>
                    <div className={cn(
                      "bg-white/70 dark:bg-blue-900/20 rounded-lg border border-blue-200/50 dark:border-blue-800/50",
                      isMobile ? "p-4" : "p-3"
                    )}>
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                        <span className={cn("font-medium text-blue-800 dark:text-blue-200", isMobile ? "text-sm" : "text-xs")}>记忆内容</span>
                        <span className={cn("text-blue-600 dark:text-blue-400", isMobile ? "text-sm" : "text-xs")}>({editableMemoryContent.length}/500)</span>
                      </div>
                      <textarea
                        value={editableMemoryContent}
                        onChange={(e) => setEditableMemoryContent(e.target.value)}
                        className={cn(
                          "w-full border border-blue-200 dark:border-blue-700 rounded bg-white dark:bg-blue-950/30 text-blue-900 dark:text-blue-100 resize-none focus:ring-1 focus:ring-blue-500 focus:border-transparent",
                          isMobile ? "p-3 text-base" : "p-2 text-sm"
                        )}
                        rows={isMobile ? 4 : 3}
                        maxLength={500}
                        placeholder="请输入要记住的重要信息..."
                      />
                    </div>

                    <div className={cn(
                      "bg-white/70 dark:bg-indigo-900/20 rounded-lg border border-indigo-200/50 dark:border-indigo-800/50",
                      isMobile ? "p-4" : "p-3"
                    )}>
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
                        <span className={cn("font-medium text-indigo-800 dark:text-indigo-200", isMobile ? "text-sm" : "text-xs")}>更新原因</span>
                        <span className={cn("text-indigo-600 dark:text-indigo-400", isMobile ? "text-sm" : "text-xs")}>({editableMemoryReason.length}/200)</span>
                      </div>
                      <textarea
                        value={editableMemoryReason}
                        onChange={(e) => setEditableMemoryReason(e.target.value)}
                        className={cn(
                          "w-full border border-indigo-200 dark:border-indigo-700 rounded bg-white dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-100 resize-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent",
                          isMobile ? "p-3 text-base" : "p-2 text-sm"
                        )}
                        rows={isMobile ? 3 : 2}
                        maxLength={200}
                        placeholder="说明为什么需要记住这些信息..."
                      />
                    </div>

                    {/* 验证提示 */}
                    {(hasSpecialChars || isContentTooLong || isReasonTooLong) && (
                      <div className={cn(
                        "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded",
                        isMobile ? "p-3" : "p-2"
                      )}>
                        <div className={cn(
                          "text-red-700 dark:text-red-300 space-y-1",
                          isMobile ? "text-sm" : "text-xs"
                        )}>
                          {hasSpecialChars && <div>• 不能包含特殊符号</div>}
                          {isContentTooLong && <div>• 记忆内容超出500字</div>}
                          {isReasonTooLong && <div>• 更新原因超出200字</div>}
                        </div>
                      </div>
                    )}

                    <div className={cn(
                      "flex pt-2",
                      isMobile ? "space-x-3" : "space-x-2"
                    )}>
                      <Button
                        size="sm"
                        onClick={() => {
                          if (isMemoryContentValid && !hasSpecialChars && !isContentTooLong && !isReasonTooLong) {
                            setIsEditing(false)
                          }
                        }}
                        disabled={!isMemoryContentValid || hasSpecialChars || isContentTooLong || isReasonTooLong}
                        className={cn(
                          "flex-1 bg-green-600 hover:bg-green-700 text-white disabled:opacity-50",
                          isMobile ? "text-sm py-2" : "text-xs py-1"
                        )}
                      >
                        ✓ 保存
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsEditing(false)}
                        className={cn(
                          "flex-1 border-gray-300 text-gray-700 hover:bg-gray-50",
                          isMobile ? "text-sm py-2" : "text-xs py-1"
                        )}
                      >
                        取消
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* 思考过程部分 */}
      {hasReasoning && (
        <div className="border border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowReasoning(!showReasoning)}
            className={cn(
              "w-full justify-between p-3 h-auto bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 border-0 rounded-none",
              isMobile ? "text-xs" : "text-sm"
            )}
          >
            <div className="flex items-center space-x-2">
              <Brain className={cn("text-blue-600 dark:text-blue-400", isMobile ? "h-3 w-3" : "h-4 w-4")} />
              <span className="font-medium text-blue-900 dark:text-blue-100">
                AI思考过程
                {isStreaming && !hasCompleteReasoning && (
                  <span className="ml-2 text-xs text-blue-500 animate-pulse">正在思考...</span>
                )}
              </span>
            </div>
            {showReasoning ? (
              <ChevronUp className={cn("text-blue-600 dark:text-blue-400", isMobile ? "h-3 w-3" : "h-4 w-4")} />
            ) : (
              <ChevronDown className={cn("text-blue-600 dark:text-blue-400", isMobile ? "h-3 w-3" : "h-4 w-4")} />
            )}
          </Button>

          {showReasoning && (
            <div className="p-3 bg-blue-50/50 dark:bg-blue-900/10 border-t border-blue-200 dark:border-blue-800">
              <div className={cn(
                "text-blue-800 dark:text-blue-200",
                isMobile ? "text-xs" : "text-sm"
              )}>
                <MarkdownRenderer
                  content={reasoning}
                  className="prose-blue text-inherit [&_p]:text-blue-800 dark:[&_p]:text-blue-200 [&_strong]:text-blue-900 dark:[&_strong]:text-blue-100"
                />
                {isStreaming && !hasCompleteReasoning && (
                  <div className="flex items-center space-x-2 mt-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: "0.2s" }}></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: "0.4s" }}></div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 主要内容部分 - 如果有记忆更新请求，则分段显示 */}
      {hasMemoryRequest ? (
        <div className={cn("", isMobile ? "text-sm" : "")}>
          {/* 记忆更新请求前的内容 */}
          {contentBeforeMemory && (
            <div className="mb-3">
              <MarkdownRenderer content={contentBeforeMemory} className="text-inherit" />
            </div>
          )}

          {/* 记忆更新请求 */}
          {renderMemoryUpdateRequest()}

          {/* 记忆更新请求后的内容 */}
          {contentAfterMemory && (
            <div className="mt-3">
              <MarkdownRenderer content={contentAfterMemory} className="text-inherit" />
            </div>
          )}
        </div>
      ) : (
        /* 没有记忆更新请求时，显示完整内容 */
        <div className={cn("", isMobile ? "text-sm" : "")}>
          <MarkdownRenderer content={mainContent} className="text-inherit" />
        </div>
      )}
    </div>
  )
})

EnhancedMessageRenderer.displayName = 'EnhancedMessageRenderer'

export { EnhancedMessageRenderer }

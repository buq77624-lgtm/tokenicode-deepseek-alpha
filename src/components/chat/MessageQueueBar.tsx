import { memo, useState } from 'react';
import { useChatStore, useActiveTab, type QueuedMessage, getQueuedMessageText, getQueuedMessageId } from '../../stores/chatStore';
import { useT } from '../../lib/i18n';

interface MessageQueueBarProps {
  tabId: string;
}

export const MessageQueueBar = memo(function MessageQueueBar({ tabId }: MessageQueueBarProps) {
  const t = useT();
  const pendingMessages = useActiveTab((t) => t.pendingUserMessages) || [];
  const [expanded, setExpanded] = useState(true);

  if (pendingMessages.length === 0) return null;

  const count = pendingMessages.length;

  const handleRecallItem = (item: QueuedMessage | string, index: number) => {
    const id = getQueuedMessageId(item, index);
    useChatStore.getState().restorePendingMessageToDraft(tabId, id);
  };

  const handleRemoveItem = (item: QueuedMessage | string, index: number) => {
    const id = getQueuedMessageId(item, index);
    useChatStore.getState().removePendingMessage(tabId, id);
  };

  const handleJumpAndRun = (item: QueuedMessage | string, index: number) => {
    const id = getQueuedMessageId(item, index);
    window.dispatchEvent(new CustomEvent('tokenicode:interrupt-and-send', { detail: { queueId: id } }));
  };

  const handleMoveToTop = (index: number) => {
    if (index > 0) {
      useChatStore.getState().reorderPendingMessages(tabId, index, 0);
    }
  };

  const handleMoveUp = (index: number) => {
    if (index > 0) {
      useChatStore.getState().reorderPendingMessages(tabId, index, index - 1);
    }
  };

  const handleMoveDown = (index: number) => {
    if (index < pendingMessages.length - 1) {
      useChatStore.getState().reorderPendingMessages(tabId, index, index + 1);
    }
  };

  const handleRecallAll = () => {
    useChatStore.getState().clearPendingMessages(tabId, true);
  };

  const handleClearAll = () => {
    useChatStore.getState().clearPendingMessages(tabId, false);
  };

  return (
    <div className="mb-2 rounded-2xl border border-border-subtle bg-bg-card/90 backdrop-blur-md shadow-md p-3 transition-smooth animate-scale-in">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-left cursor-pointer group select-none"
        >
          <span className="w-5 h-5 rounded-full bg-accent/15 text-accent flex items-center justify-center shadow-sm">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M2 4h12M2 8h8M2 12h5" />
            </svg>
          </span>
          <span className="text-xs font-semibold text-text-primary group-hover:text-accent transition-colors">
            {t('queue.title')}
          </span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-accent font-medium">
            {t('queue.itemCount', { count })}
          </span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className={`text-text-tertiary transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          >
            <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleRecallAll}
            className="px-2 py-1 rounded-md text-[11px] font-medium text-text-muted hover:text-accent hover:bg-bg-tertiary/60 transition-smooth cursor-pointer"
            title={t('queue.recallAll')}
          >
            {t('queue.recallAll')}
          </button>
          <span className="text-border-subtle text-xs select-none">•</span>
          <button
            onClick={handleClearAll}
            className="px-2 py-1 rounded-md text-[11px] font-medium text-red-400 hover:text-red-500 hover:bg-red-500/10 transition-smooth cursor-pointer"
            title={t('queue.clear')}
          >
            {t('queue.clear')}
          </button>
        </div>
      </div>

      {/* Expanded queue message list */}
      {expanded && (
        <div className="mt-2.5 pt-2 border-t border-border-subtle/50 space-y-1.5 max-h-48 overflow-y-auto">
          {pendingMessages.map((item, index) => {
            const text = getQueuedMessageText(item);
            const isFirst = index === 0;
            const isLast = index === pendingMessages.length - 1;

            return (
              <div
                key={getQueuedMessageId(item, index)}
                className="flex items-center justify-between gap-2.5 px-2.5 py-1.5 rounded-xl bg-bg-secondary/40 hover:bg-bg-secondary/70 border border-border-subtle/40 transition-smooth group"
              >
                {/* Left: Queue sequence badge & text preview */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="flex-shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded bg-accent/15 text-accent font-bold">
                    #{index + 1}
                  </span>
                  <p
                    className="text-xs text-text-primary truncate select-text leading-relaxed"
                    title={text}
                  >
                    {text}
                  </p>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Jump & Run (叫停并插队) */}
                  <button
                    onClick={() => handleJumpAndRun(item, index)}
                    className="flex items-center px-2 py-0.5 rounded text-[11px] font-medium text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-smooth cursor-pointer"
                    title={t('queue.jumpAndRunHint')}
                  >
                    <span>{t('queue.jumpAndRun')}</span>
                  </button>

                  {/* Move to Top */}
                  {index > 0 && (
                    <button
                      onClick={() => handleMoveToTop(index)}
                      className="p-1 rounded text-text-tertiary hover:text-accent hover:bg-bg-tertiary transition-smooth cursor-pointer"
                      title={t('queue.moveToTopHint')}
                    >
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M2 3h12M4 11l4-4 4 4M8 7v6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  )}

                  {/* Reorder Up */}
                  <button
                    onClick={() => handleMoveUp(index)}
                    disabled={isFirst}
                    className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary disabled:opacity-20 disabled:cursor-not-allowed transition-smooth"
                    title={t('queue.moveUp')}
                  >
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 10l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  {/* Reorder Down */}
                  <button
                    onClick={() => handleMoveDown(index)}
                    disabled={isLast}
                    className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary disabled:opacity-20 disabled:cursor-not-allowed transition-smooth"
                    title={t('queue.moveDown')}
                  >
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  {/* Recall to input draft */}
                  <button
                    onClick={() => handleRecallItem(item, index)}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] text-text-muted hover:text-accent hover:bg-accent/10 transition-smooth cursor-pointer ml-0.5"
                    title={t('queue.recall')}
                  >
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M2 7h9a3 3 0 013 3v2M2 7l4-4M2 7l4 4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>{t('queue.recall')}</span>
                  </button>

                  {/* Cancel / Delete */}
                  <button
                    onClick={() => handleRemoveItem(item, index)}
                    className="p-1 rounded text-text-tertiary hover:text-red-400 hover:bg-red-400/10 transition-smooth cursor-pointer"
                    title={t('queue.cancel')}
                  >
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

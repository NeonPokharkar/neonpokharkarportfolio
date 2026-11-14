export async function readIntelliChatFinalAnswer(
  response: Response,
  onPartialAnswer?: (answer: string) => void
): Promise<string> {
  if (!response.body) {
    throw new Error('The AI chat server did not return a readable response stream.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let plainResponse = '';
  let finalAnswer = '';
  let hasStructuredEvents = false;

  const appendPlainText = (chunk: string): void => {
    plainResponse += chunk;
    const finalAnswerMarker = /Final[_\s]+answer\s*:\s*/i.exec(plainResponse);
    finalAnswer = finalAnswerMarker
      ? plainResponse.slice(finalAnswerMarker.index + finalAnswerMarker[0].length).trimStart()
      : '';
    onPartialAnswer?.(finalAnswer);
  };

  const processPending = (flush: boolean): void => {
    while (pending) {
      const firstContentIndex = pending.search(/\S/);
      if (firstContentIndex === -1) {
        if (flush) {
          pending = '';
        }
        return;
      }

      if (firstContentIndex > 0) {
        const rest = pending.slice(firstContentIndex);
        if (rest.startsWith('{')) {
          pending = rest;
        } else {
          const nextEventIndex = rest.indexOf('{');
          if (nextEventIndex === -1) {
            appendPlainText(pending);
            pending = '';
            return;
          }
          appendPlainText(pending.slice(0, firstContentIndex + nextEventIndex));
          pending = rest.slice(nextEventIndex);
          continue;
        }
      }

      if (!pending.startsWith('{')) {
        const nextEventIndex = pending.indexOf('{');
        if (nextEventIndex === -1) {
          appendPlainText(pending);
          pending = '';
          return;
        }
        appendPlainText(pending.slice(0, nextEventIndex));
        pending = pending.slice(nextEventIndex);
        continue;
      }

      let objectDepth = 0;
      let insideString = false;
      let escaped = false;
      let eventEnd = -1;

      for (let index = 0; index < pending.length; index += 1) {
        const character = pending[index];
        if (insideString) {
          if (escaped) {
            escaped = false;
          } else if (character === '\\') {
            escaped = true;
          } else if (character === '"') {
            insideString = false;
          }
        } else if (character === '"') {
          insideString = true;
        } else if (character === '{') {
          objectDepth += 1;
        } else if (character === '}') {
          objectDepth -= 1;
          if (objectDepth === 0) {
            eventEnd = index;
            break;
          }
        }
      }

      if (eventEnd === -1) {
        if (flush) {
          appendPlainText(pending);
          pending = '';
        }
        return;
      }

      const eventText = pending.slice(0, eventEnd + 1);
      pending = pending.slice(eventEnd + 1);

      try {
        const event: unknown = JSON.parse(eventText);
        if (
          typeof event === 'object' &&
          event !== null &&
          'type' in event &&
          typeof event.type === 'string' &&
          'content' in event &&
          typeof event.content === 'string'
        ) {
          hasStructuredEvents = true;
          if (event.type.toLowerCase() === 'final_answer') {
            finalAnswer += event.content;
            onPartialAnswer?.(finalAnswer);
          }
        } else {
          appendPlainText(eventText);
        }
      } catch {
        appendPlainText(eventText);
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    pending += decoder.decode(value, { stream: !done });
    processPending(done);
    if (done) {
      break;
    }
  }

  if (!hasStructuredEvents && !/Final[_\s]+answer\s*:\s*/i.test(plainResponse)) {
    finalAnswer = plainResponse.trim();
  }

  if (!finalAnswer.trim()) {
    throw new Error('The AI chat server returned an empty final answer.');
  }

  return finalAnswer.trim();
}

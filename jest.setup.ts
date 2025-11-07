// Ensure React 19 treats this environment as act-compatible.
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const originalConsoleError = console.error;
const suppressedPatterns = [/react-test-renderer is deprecated/];

console.error = (...args: unknown[]) => {
  const [first] = args;
  if (typeof first === 'string' && suppressedPatterns.some((pattern) => pattern.test(first))) {
    return;
  }
  originalConsoleError(...args);
};

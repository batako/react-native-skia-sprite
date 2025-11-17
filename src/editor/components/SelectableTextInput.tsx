import React, { useCallback, useRef } from 'react';
import { TextInput, type TextInputProps } from 'react-native';

export interface SelectableTextInputProps extends TextInputProps {
  autoSelect?: boolean;
}

export const SelectableTextInput = React.forwardRef<TextInput, SelectableTextInputProps>(
  ({ selectTextOnFocus = true, autoSelect = true, onFocus, value, ...rest }, forwardedRef) => {
    const innerRef = useRef<TextInput>(null);

    const assignRef = useCallback(
      (node: TextInput | null) => {
        innerRef.current = node;
        if (typeof forwardedRef === 'function') {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef],
    );

    const handleFocus = useCallback(
      (event: Parameters<NonNullable<TextInputProps['onFocus']>>[0]) => {
        if (autoSelect) {
          const node = innerRef.current;
          if (node) {
            const textValue =
              typeof value === 'string'
                ? value
                : typeof node.props.value === 'string'
                  ? (node.props.value as string)
                  : typeof node.props.defaultValue === 'string'
                    ? (node.props.defaultValue as string)
                    : '';
            if (textValue.length > 0) {
              requestAnimationFrame(() => {
                node.setNativeProps({
                  selection: { start: 0, end: textValue.length },
                });
              });
            }
          }
        }
        onFocus?.(event);
      },
      [autoSelect, onFocus, value],
    );

    return (
      <TextInput
        ref={assignRef}
        selectTextOnFocus={selectTextOnFocus}
        onFocus={handleFocus}
        value={value}
        {...rest}
      />
    );
  },
);

SelectableTextInput.displayName = 'SelectableTextInput';

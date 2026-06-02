import React, { useCallback, useState } from 'react';
import { FileUpload } from '@patternfly/react-core';

const PEM_ACCEPT = {
  'application/x-pem-file': ['.pem'],
  'application/x-x509-ca-cert': ['.crt', '.cer'],
  'application/pkcs8': ['.key'],
  'text/plain': ['.pem', '.crt', '.cer', '.key'],
};

export interface PemFileFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isRequired?: boolean;
  browseButtonText?: string;
}

export function PemFileField({
  id,
  value,
  onChange,
  placeholder = 'Drag and drop a PEM file here, or browse to upload',
  isRequired,
  browseButtonText = 'Browse',
}: PemFileFieldProps) {
  const [filename, setFilename] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleFileInputChange = useCallback((_event: unknown, file: File) => {
    setFilename(file.name);
  }, []);

  const handleDataChange = useCallback((_event: unknown, data: string) => {
    onChange(data);
  }, [onChange]);

  const handleTextChange = useCallback(
    (_event: React.ChangeEvent<HTMLTextAreaElement>, text: string) => {
      onChange(text);
    },
    [onChange],
  );

  const handleClear = useCallback(() => {
    setFilename('');
    onChange('');
  }, [onChange]);

  return (
    <FileUpload
      id={id}
      type="text"
      value={value}
      filename={filename}
      filenamePlaceholder={placeholder}
      onFileInputChange={handleFileInputChange}
      onDataChange={handleDataChange}
      onTextChange={handleTextChange}
      onClearClick={handleClear}
      onReadStarted={() => setIsLoading(true)}
      onReadFinished={() => setIsLoading(false)}
      isLoading={isLoading}
      allowEditingUploadedText
      browseButtonText={browseButtonText}
      clearButtonText="Clear"
      isRequired={isRequired}
      dropzoneProps={{ accept: PEM_ACCEPT, multiple: false }}
    />
  );
}

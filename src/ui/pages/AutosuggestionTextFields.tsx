import React, { useState, useEffect } from "react";
import { Autocomplete, TextField, CircularProgress } from "@mui/material";
import axios from "axios";

interface DynamicAutocompleteProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

const DynamicAutocomplete: React.FC<DynamicAutocompleteProps> = ({
  label,
  value,
  onChange,
}) => {
  const [inputValue, setInputValue] = useState(value || "");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (inputValue.length < 2) return;

      setLoading(true);
      try {
        const response = await axios.get(
          `https://api.datamuse.com/sug?s=${inputValue}`
        );
        const words = response.data.map((item: any) => item.word);
        setSuggestions(words);
      } catch (error) {
        console.error("Failed to fetch suggestions:", error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounce);
  }, [inputValue]);

  return (
    <Autocomplete
      freeSolo
      options={suggestions}
      loading={loading}
      inputValue={inputValue}
      onInputChange={(event, newInputValue) => {
        const capitalized =
          newInputValue.charAt(0).toUpperCase() + newInputValue.slice(1);
        setInputValue(capitalized);
        onChange(capitalized);
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          fullWidth
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress size={16} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
};

export default DynamicAutocomplete;

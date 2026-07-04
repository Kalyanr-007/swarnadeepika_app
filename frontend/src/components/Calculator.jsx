import React, { useState } from "react";
import { Calculator as CalculatorIcon, X } from "lucide-react";
import { Button } from "./ui/button";

const Calculator = () => {
  const [input, setInput] = useState("");
  const [result, setResult] = useState("");

  const handleButtonClick = (value) => {
    if (value === "=") {
      try {
        // Use Function instead of eval for a bit more safety in this context
        const evaluated = new Function(`return ${input}`)();
        setResult(evaluated.toString());
      } catch (error) {
        setResult("Error");
      }
    } else if (value === "C") {
      setInput("");
      setResult("");
    } else if (value === "DEL") {
      setInput(input.slice(0, -1));
    } else {
      setInput(input + value);
    }
  };

  const buttons = [
    "7", "8", "9", "/",
    "4", "5", "6", "*",
    "1", "2", "3", "-",
    "0", ".", "=", "+",
    "C", "DEL"
  ];

  return (
    <div className="p-4 bg-white rounded-lg shadow-inner w-64 border border-slate-200">
      <div className="bg-slate-100 p-2 rounded mb-4 text-right min-h-[60px] flex flex-col justify-end border border-slate-300">
        <div className="text-slate-500 text-xs truncate mb-1">{input || "0"}</div>
        <div className="text-xl font-bold text-slate-800 truncate">{result || "0"}</div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {buttons.map((btn) => (
          <Button
            key={btn}
            variant={["/", "*", "-", "+", "="].includes(btn) ? "default" : "outline"}
            className={`${btn === "C" ? "col-span-2 bg-red-50 hover:bg-red-100 text-red-600 border-red-200" : btn === "DEL" ? "col-span-2" : ""}`}
            onClick={() => handleButtonClick(btn)}
          >
            {btn}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default Calculator;

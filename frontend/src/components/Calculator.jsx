import React, { useState, useRef, useEffect } from 'react';
import { Calculator as CalcIcon, X, GripHorizontal } from 'lucide-react';
import { Button } from './ui/button';

const Calculator = ({ onClose }) => {
  const [input, setInput] = useState('0');
  const [prev, setPrev] = useState(null);
  const [op, setOp] = useState(null);
  const [reset, setReset] = useState(false);

  // Dragging logic
  const [pos, setPos] = useState({ x: window.innerWidth - 320, y: 100 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const onMouseDown = (e) => {
    setDragging(true);
    dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  };

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!dragging) return;
      setPos({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
    };
    const onMouseUp = () => setDragging(false);

    if (dragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragging]);

  const handleNum = (n) => {
    if (input === '0' || reset) {
      setInput(n);
      setReset(false);
    } else {
      setInput(input + n);
    }
  };

  const handleOp = (o) => {
    if (op && !reset) {
      calculate();
    } else {
      setPrev(parseFloat(input));
    }
    setOp(o);
    setReset(true);
  };

  const calculate = () => {
    if (!op || prev === null) return;
    const current = parseFloat(input);
    let result = 0;
    switch (op) {
      case '+': result = prev + current; break;
      case '-': result = prev - current; break;
      case '*': result = prev * current; break;
      case '/': result = current !== 0 ? prev / current : 'Error'; break;
      default: return;
    }
    setInput(String(result));
    setPrev(result);
    setOp(null);
    setReset(true);
  };

  const clear = () => {
    setInput('0');
    setPrev(null);
    setOp(null);
    setReset(false);
  };

  const buttons = [
    '7', '8', '9', '/',
    '4', '5', '6', '*',
    '1', '2', '3', '-',
    '0', '.', '=', '+'
  ];

  return (
    <div
      style={{ left: pos.x, top: pos.y }}
      className="fixed z-[999] w-64 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden flex flex-col"
    >
      {/* Header / Drag handle */}
      <div
        onMouseDown={onMouseDown}
        className="bg-slate-100 p-2 flex items-center justify-between cursor-move select-none"
      >
        <div className="flex items-center gap-2 text-slate-600 font-medium">
          <GripHorizontal className="w-4 h-4" />
          <span className="text-xs">Calculator</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Display */}
      <div className="bg-slate-800 p-4 text-right">
        <div className="text-[10px] text-slate-400 h-4 uppercase tracking-wider">
          {prev !== null && `${prev} ${op || ''}`}
        </div>
        <div className="text-2xl font-mono text-white truncate">
          {input}
        </div>
      </div>

      {/* Keys */}
      <div className="p-3 grid grid-cols-4 gap-2">
        <Button variant="outline" className="col-span-4 h-10 text-red-600 font-bold" onClick={clear}>C</Button>
        {buttons.map((b) => (
          <Button
            key={b}
            variant={['/', '*', '-', '+', '='].includes(b) ? 'default' : 'outline'}
            className={`h-12 text-lg font-medium ${b === '=' ? 'bg-green-700 hover:bg-green-800' : ''}`}
            onClick={() => {
              if (b === '=') calculate();
              else if (['/', '*', '-', '+'].includes(b)) handleOp(b);
              else handleNum(b);
            }}
          >
            {b}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default Calculator;

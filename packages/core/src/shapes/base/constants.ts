import {
    blendHex,
} from '../../math/colour';

import {
    continuous,
} from '../../math/scale';

import {
    BaseShape,
    ContextRen,
    ShapeCalculators,
} from './types';

export const CALCULATORS: ShapeCalculators<BaseShape> = {
    strokeStyle: (valueA, valueB) => time => blendHex(valueA, valueB, time),
    fillStyle: (valueA, valueB) => time => blendHex(valueA, valueB, time),
    lineDash: (valueA, valueB) => {
        const scales = valueA?.map((segA, i) => continuous([0, 1], [segA, valueB[i]]));
        return time => scales?.map(scale => scale(time, true));
    },
};

export const CONTEXT_MAP = {
    strokeStyle: (context, value) => {
        if (value) context.strokeStyle = value;
    },
    fillStyle: (context, value) => {
        if (value) context.fillStyle = value;
    },
    lineWidth: (context, value) => {
        if (value) context.lineWidth = value;
    },
    lineCap: (context, value) => {
        if (value) context.lineCap = value;
    },
    lineJoin: (context, value) => {
        if (value) context.lineJoin = value;
    },
    lineDash: (context, value) => {
        if (value) context.setLineDash(value);
    },
    lineDashOffset: (context, value) => {
        if (value) context.lineDashOffset = value;
    },
} as ContextRen;
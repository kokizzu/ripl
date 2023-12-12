import {
    createEventBus,
} from './event-bus';

import {
    isGroup,
} from './group';

import {
    easeLinear,
} from '../animation';

import {
    clamp,
} from '../math';

import {
    arrayForEach,
    OneOrMore,
    typeIsFunction,
} from '@ripl/utilities';

import type {
    Element,
    Renderer,
    RendererEventMap,
    RendererOptions,
    RendererTransition,
    RendererTransitionOptions,
    RendererTransitionOptionsArg,
    Scene,
} from './types';

export function createRenderer(
    scene: Scene,
    options?: RendererOptions
): Renderer {
    let rendererOptions = {
        autoStart: true,
        autoStop: true,
        ...options,
    };

    const {
        canvas,
        context,
    } = scene;

    const transitionMap = new Map<string, RendererTransition>();

    const {
        on,
        off,
        emit,
    } = createEventBus<RendererEventMap>();

    let running = false;
    let handle: number | undefined;
    let startTime = performance.now();
    let currentTime = performance.now();

    function tick() {
        if (!running) {
            return;
        }

        context.clearRect(0, 0, canvas.width, canvas.height);

        currentTime = performance.now();

        arrayForEach(scene.elements, element => {
            if (transitionMap.has(element.id)) {
                let time = 0;

                const {
                    startTime,
                    duration,
                    ease,
                    loop,
                    direction,
                    interpolator,
                    callback,
                } = transitionMap.get(element.id)!;

                const elapsed = currentTime - startTime;

                if (elapsed > 0) {
                    time = clamp(elapsed / duration, 0, 1);
                    time = ease(direction === 'reverse' ? 1 - time : time);

                    element.setState(interpolator(time));

                    if (elapsed >= duration) {
                        callback();
                    }
                }
            }

            element.render(context);

            if (rendererOptions.debug?.boundingBoxes) {
                const {
                    left,
                    top,
                    width,
                    height,
                } = element.getBoundingBox();

                context.save();
                context.strokeStyle = '#FF0000';
                context.strokeRect(left, top, width, height);
                context.restore();
            }
        });

        handle = requestAnimationFrame(tick);
    }

    function start() {
        if (running) {
            return;
        }

        running = true;
        startTime = performance.now();
        transitionMap.clear();

        emit('renderer:start', { startTime });
        requestAnimationFrame(tick);
    }

    function stop() {
        if (!running) {
            return;
        }

        if (handle) {
            cancelAnimationFrame(handle);
        }

        running = false;
        transitionMap.clear();

        emit('renderer:stop', {
            startTime,
            endTime: currentTime,
        });
    }

    function stopOnIdle() {
        if (rendererOptions.autoStop && transitionMap.size === 0) {
            stop();
        }
    }

    function transition<TElement extends Element>(element: OneOrMore<TElement>, options?: RendererTransitionOptionsArg<TElement>) {
        start();

        const getOptions = typeIsFunction(options)
            ? options
            : () => options || {} as RendererTransitionOptions<TElement>;

        return new Promise<void>(resolve => {
            const elements = ([] as TElement[]).concat(element).flatMap(element => {
                return isGroup(element) ? element.elements : element;
            });

            if (!elements.length) {
                resolve();
            }

            const totalCount = elements.length;
            let completeCount = 0;

            elements.forEach((element, index) => {
                transitionMap.get(element.id)?.callback();

                const {
                    duration = 0,
                    delay = 0,
                    loop = false,
                    ease = easeLinear,
                    callback = () => {},
                    direction = 'forward',
                    state,
                } = getOptions(element, index, totalCount);

                const startTime = performance.now() + delay;

                const onComplete = () => {
                    completeCount += 1;
                    transitionMap.delete(element.id);

                    // if (fillMode === 'forwards') {
                    //     element.setProps(element.getState());
                    // }

                    try {
                        callback(element);
                    } finally {
                        stopOnIdle();

                        if (completeCount >= totalCount) {
                            resolve();
                        }
                    }
                };

                transitionMap.set(element.id, {
                    loop,
                    ease,
                    startTime,
                    direction,
                    duration: rendererOptions.immediate ? 1 : duration,
                    interpolator: element.interpolate(state),
                    callback: onComplete,
                });
            });
        });
    }

    function update(options: Partial<RendererOptions>) {
        rendererOptions = {
            ...rendererOptions,
            ...options,
        };
    }

    if (rendererOptions.autoStart) {
        start();
    }

    if (rendererOptions.autoStop) {
        scene.on('scene:mouseenter', start);
        scene.on('scene:mouseleave', stopOnIdle);
    }

    return {
        start,
        stop,
        update,
        transition,
        on,
        off,

        get running() {
            return running;
        },

        get busy() {
            return transitionMap.size > 0;
        },
    };
}
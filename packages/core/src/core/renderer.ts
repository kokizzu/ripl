import {
    isGroup,
} from './group';

import {
    easeLinear,
} from '../animation';

import {
    min,
} from '../math';

import {
    arrayForEach,
    isFunction,
    OneOrMore,
    setForEach,
} from '@ripl/utilities';

import type {
    Element,
    Renderer,
    RendererEventMap,
    RendererOptions,
    RendererTransition,
    RendererTransitionOptions,
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
    const eventMap = {
        start: new Set(),
        stop: new Set(),
        tick: new Set(),
    } as {
        [P in keyof RendererEventMap]: Set<RendererEventMap[P]>;
    };

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

        setForEach(eventMap.tick, handler => handler(currentTime, startTime));
        arrayForEach(scene.elements, element => {
            let time = 0;

            if (transitionMap.has(element.id)) {
                const {
                    startTime,
                    duration,
                    ease,
                    loop,
                    callback,
                } = {
                    startTime: currentTime,
                    duration: 0,
                    ease: easeLinear,
                    loop: false,
                    callback: () => {},
                    ...transitionMap.get(element.id),
                };

                const elapsed = currentTime - startTime;

                if (elapsed > 0) {
                    time = ease(min(elapsed / duration, 1));

                    if (elapsed >= duration) {
                        transitionMap.delete(element.id);
                        callback();
                    }
                }
            }

            element.render(context, time);
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

        setForEach(eventMap.start, handler => handler(startTime));
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

        setForEach(eventMap.stop, handler => handler(startTime, currentTime));
    }

    function stopOnIdle() {
        if (rendererOptions.autoStop && transitionMap.size === 0) {
            stop();
        }
    }

    function transition(element: OneOrMore<Element<any>>, options?: Partial<RendererTransitionOptions>) {
        start();

        return new Promise<void>(resolve => {
            const elements = ([] as Element[]).concat(element).flatMap(element => {
                return isGroup(element) ? element.elements : element;
            });

            if (!elements.length) {
                resolve();
            }

            const totalCount = elements.length;
            let completeCount = 0;

            elements.forEach((element, index) => {
                const {
                    duration,
                    delay,
                    loop,
                    ease,
                    callback,
                    fillMode,
                } = {
                    duration: 0,
                    delay: 0,
                    loop: false,
                    ease: easeLinear,
                    fillMode: 'forwards',
                    callback: () => {},
                    ...options,
                } as RendererTransitionOptions;

                const startTime = performance.now() + (isFunction(delay)
                    ? delay(index, elements.length)
                    : delay
                );

                const onComplete = () => {
                    completeCount += 1;

                    if (fillMode === 'forwards') {
                        element.update(element.state());
                    }

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
                    duration: rendererOptions.immediate ? 1 : duration,
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

    function on<TEvent extends keyof RendererEventMap>(event: TEvent, handler: RendererEventMap[TEvent]) {
        eventMap[event]?.add(handler);
    }

    function off<TEvent extends keyof RendererEventMap>(event: TEvent, handler: RendererEventMap[TEvent]) {
        eventMap[event]?.delete(handler);
    }

    if (rendererOptions.autoStart) {
        start();
    }

    if (rendererOptions.autoStop) {
        scene.on('scenemouseenter', start);
        scene.on('scenemouseleave', stopOnIdle);
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
import { useEffect } from 'react';
import type { FC } from 'react';

const MOTION_TARGETS = [
  '#root h1',
  '#root h2',
  '#root h3',
  '#root p',
  '#root li',
  '#root section',
  '#root article',
  '#root .surface-rule',
  '#root [class*="rounded-xl"][class*="border"]',
  '#root [class*="rounded-2xl"][class*="border"]',
].join(',');

export const ScrollMotionObserver: FC = () => {
  useEffect(() => {
    const root = document.getElementById('root');
    if (!root || !('IntersectionObserver' in window)) return;

    const observed = new WeakSet<Element>();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(({ target, isIntersecting }) => {
        target.classList.toggle('is-in-view', isIntersecting);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });

    const observeElement = (element: Element) => {
      if (observed.has(element)) return;
      observed.add(element);
      element.classList.add('scroll-motion-item');
      observer.observe(element);
    };
    const observeTargets = (scope: ParentNode) => {
      scope.querySelectorAll(MOTION_TARGETS).forEach(observeElement);
    };

    observeTargets(root);
    const mutations = new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (node.matches(MOTION_TARGETS)) observeElement(node);
        observeTargets(node);
      }));
    });
    mutations.observe(root, { childList: true, subtree: true });

    return () => {
      mutations.disconnect();
      observer.disconnect();
    };
  }, []);

  return null;
};

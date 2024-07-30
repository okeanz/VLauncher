/**
 * Copyright (c) 2021, Guasam
 *
 * This software is provided "as-is", without any express or implied warranty. In no event
 * will the authors be held liable for any damages arising from the use of this software.
 * Read the LICENSE file for more details.
 *
 * @author  : guasam
 * @project : Electron Window
 * @package : Window Titlebar (Component)
 */

import React, {
  createRef,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import titlebarMenus from '@main/window/titlebarMenus';
import classNames from 'classnames';
import WindowControls from './WindowControls';
import context from '@main/window/titlebarContextApi';
import { WindowContext } from './WindowFrame';
import './titlebar.scss';

type Props = {
  title: string;
  mode: 'centered-title';
  icon?: string;
};

const Titlebar: React.FC<Props> = (props) => {
  const activeMenuIndex = useRef<number | null>(null);
  const menusRef = titlebarMenus.map(() => createRef<HTMLDivElement>());
  const windowContext = useContext(WindowContext);

  return (
    <div className='window-titlebar'>
      {props.icon ? (
        <section className='window-titlebar-icon'>
          <img src={props.icon} alt='titlebar icon' />
        </section>
      ) : (
        ''
      )}

      <section
        className={classNames('window-titlebar-content', {
          centered: props.mode === 'centered-title',
        })}
      >
        <div className='window-title'>{props.title}</div>
      </section>

      <WindowControls platform={windowContext.platform} tooltips={true} />
    </div>
  );
};

export default Titlebar;

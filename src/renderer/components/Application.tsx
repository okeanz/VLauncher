import React, { useEffect, useState } from 'react';
import '@styles/app.scss';
import ProgressBar from '@components/ProgressBar';

const Application: React.FC = () => {
  useEffect(() => {
    localStorage.setItem('dark-mode', '1');
    document.body.classList.add('dark-mode');
  }, []);

  return (
    <div id='erwt'>
      <div className='header'>
        <div className='main-heading'>
          <h1 className='themed'>Loot Goblins Presents</h1>
        </div>
        <div className='main-teaser'>
          Desktop Application with Electron, React, Webpack & TypeScript
        </div>
      </div>

      <div className='footer'>
        <ProgressBar />
      </div>
    </div>
  );
};

export default Application;

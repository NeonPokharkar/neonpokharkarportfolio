import { Component } from '@angular/core';

interface Service {
  number: string;
  title: string;
  description: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  protected readonly services: Service[] = [
    {
      number: '01',
      title: 'Brand direction',
      description: 'Find a clear voice and visual language that makes your next chapter impossible to ignore.'
    },
    {
      number: '02',
      title: 'Digital products',
      description: 'Turn complex ideas into simple, useful products people genuinely enjoy using.'
    },
    {
      number: '03',
      title: 'Web experiences',
      description: 'Build an expressive, high-performing home for your brand that works beautifully everywhere.'
    }
  ];
}

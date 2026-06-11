import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

interface FaqItem {
  question: string
  answer: string
}

interface Props {
  items: readonly FaqItem[]
  title?: string
}

export function FaqSection({ items, title = 'Frequently asked questions' }: Props) {
  return (
    <section className="space-y-6">
      {title && <h2 className="text-2xl font-bold text-center">{title}</h2>}
      <Accordion type="single" collapsible className="w-full">
        {items.map((item, i) => (
          <AccordionItem key={item.question} value={`item-${i}`}>
            <AccordionTrigger className="text-left">{item.question}</AccordionTrigger>
            <AccordionContent>{item.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}

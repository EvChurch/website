import { HeroBlockComponent } from './HeroBlockComponent'
import { ContentBlockComponent } from './ContentBlockComponent'
import { CTABlockComponent } from './CTABlockComponent'
import { CardGridBlockComponent } from './CardGridBlockComponent'
import { AccordionBlockComponent } from './AccordionBlockComponent'
import { ImageGalleryBlockComponent } from './ImageGalleryBlockComponent'
import { VideoBlockComponent } from './VideoBlockComponent'
import { FeatureGridBlockComponent } from './FeatureGridBlockComponent'
import { TimelineBlockComponent } from './TimelineBlockComponent'
import { StatsGridBlockComponent } from './StatsGridBlockComponent'
import { BlockquoteBlockComponent } from './BlockquoteBlockComponent'
import { FormEmbedBlockComponent } from './FormEmbedBlockComponent'
import { ManualCardGridBlockComponent } from './ManualCardGridBlockComponent'
import { PhotoStripBlockComponent } from './PhotoStripBlockComponent'
import { PageHeaderBlockComponent } from './PageHeaderBlockComponent'
import { GospelStepperBlockComponent } from './GospelStepperBlockComponent'
import { LatestSermonBlockComponent } from './LatestSermonBlockComponent'

/**
 * Union of all known block types.
 * Once Payload generates types, replace these with the generated interfaces.
 */
interface BaseBlock {
  blockType: string
  id?: string
}

interface MediaRef {
  id: string
  url: string
  alt: string
  width?: number
  height?: number
}

type Media = MediaRef | string

interface HeroBlock extends BaseBlock {
  blockType: 'hero'
  image: Media
  eyebrow?: string | null
  heading: string
  highlightedText?: string | null
  subtitle?: string | null
  supportingText?: string | null
  buttons?: Array<{
    label: string
    href: string
    variant?: 'primary' | 'secondary' | 'text'
    id?: string
  }> | null
  overlayStyle?: 'default' | 'cinematic' | 'leftToRight' | null
  minHeight?: '50vh' | '70vh' | '80vh' | '85vh' | null
  semanticH1?: boolean | null
}

interface ContentBlock extends BaseBlock {
  blockType: 'content'
  heading?: string | null
  body: unknown
  image?: Media | null
  alignment?: 'left' | 'center' | 'right' | null
}

interface CTABlock extends BaseBlock {
  blockType: 'cta'
  heading: string
  text?: string | null
  buttons?: Array<{
    label: string
    href: string
    variant?: 'primary' | 'secondary'
    id?: string
  }> | null
  colorPreset?: 'primary-red' | 'light' | 'dark' | null
  supportingText?: string | null
  accentColor?: string | null
  backgroundImage?: Media | null
}

interface CardGridBlock extends BaseBlock {
  blockType: 'cardGrid'
  dataSource: 'campuses' | 'events' | 'team-members'
  campusFilter?: string | null
}

interface AccordionBlock extends BaseBlock {
  blockType: 'accordion'
  heading?: string | null
  items: Array<{
    question: string
    answer: unknown
    id?: string
  }>
  allowMultiple?: boolean | null
}

interface ImageGalleryBlock extends BaseBlock {
  blockType: 'imageGallery'
  images: Array<{
    image: Media
    id?: string
  }>
}

interface VideoBlock extends BaseBlock {
  blockType: 'video'
  url: string
  caption?: string | null
}

interface FeatureGridBlock extends BaseBlock {
  blockType: 'featureGrid'
  eyebrow?: string | null
  heading?: string | null
  description?: string | null
  layout?: 'twoColumn' | 'threeColumn' | 'fourColumn' | null
  style?: 'iconTop' | 'iconLeft' | null
  items: Array<{
    icon?: string | null
    title: string
    description: string
    id?: string
  }>
  accentColor?: string | null
}

interface TimelineBlock extends BaseBlock {
  blockType: 'timeline'
  eyebrow?: string | null
  heading?: string | null
  description?: string | null
  theme?: 'dark' | 'light' | null
  events: Array<{
    year: string
    title: string
    description?: string | null
    id?: string
  }>
}

interface StatsGridBlock extends BaseBlock {
  blockType: 'statsGrid'
  eyebrow?: string | null
  heading?: string | null
  description?: string | null
  items: Array<{
    label: string
    stat: string
    statLabel: string
    description: string
    scripture?: string | null
    scriptureReference?: string | null
    id?: string
  }>
}

interface BlockquoteBlockType extends BaseBlock {
  blockType: 'blockquote'
  quote: string
  attribution?: string | null
  style?: 'centered' | 'leftBorder' | null
}

interface FormEmbedBlock extends BaseBlock {
  blockType: 'formEmbed'
  eyebrow?: string | null
  heading?: string | null
  description?: string | null
  formType: 'contact' | 'signup'
  formTitle?: string | null
  layout?: 'full' | 'centered' | null
}

interface ManualCardGridBlock extends BaseBlock {
  blockType: 'manualCardGrid'
  eyebrow?: string | null
  heading?: string | null
  description?: string | null
  cardStyle?: 'info' | 'imageOverlay' | 'imageTop' | 'alternatingRows' | null
  columns?: '2' | '3' | '4' | null
  cards: Array<{
    image?: Media | null
    eyebrow?: string | null
    title: string
    subtitle?: string | null
    description?: string | null
    address?: string | null
    href?: string | null
    linkLabel?: string | null
    details?: Array<{ label: string; value: string; id?: string }> | null
    id?: string
  }>
}

interface PhotoStripBlock extends BaseBlock {
  blockType: 'photoStrip'
  layout?: 'horizontalScroll' | 'grid4' | 'grid2' | 'masonry' | null
  images: Array<{
    image: Media
    id?: string
  }>
}

interface PageHeaderBlock extends BaseBlock {
  blockType: 'pageHeader'
  eyebrow?: string | null
  heading: string
  description?: string | null
  theme?: 'dark' | 'light' | null
}

interface GospelStepperBlockType extends BaseBlock {
  blockType: 'gospelStepper'
  heading?: string | null
  steps: Array<{
    stepTitle: string
    heading: string
    body?: unknown
    image?: Media | null
    imagePosition?: 'left' | 'right' | 'background' | null
    id?: string
  }>
  finalCTA?: {
    heading?: string | null
    text?: string | null
    buttons?: Array<{
      label: string
      href: string
      variant?: 'primary' | 'secondary'
      id?: string
    }> | null
  } | null
}

interface LatestSermonBlockType extends BaseBlock {
  blockType: 'latestSermon'
  heading?: string | null
}

type Block =
  | HeroBlock
  | ContentBlock
  | CTABlock
  | CardGridBlock
  | AccordionBlock
  | ImageGalleryBlock
  | VideoBlock
  | FeatureGridBlock
  | TimelineBlock
  | StatsGridBlock
  | BlockquoteBlockType
  | FormEmbedBlock
  | ManualCardGridBlock
  | PhotoStripBlock
  | PageHeaderBlock
  | GospelStepperBlockType
  | LatestSermonBlockType
  | BaseBlock

interface RenderBlocksProps {
  blocks: Block[]
}

export function RenderBlocks({ blocks }: RenderBlocksProps) {
  if (!blocks || blocks.length === 0) return null

  return (
    <>
      {blocks.map((block, index) => {
        const key = block.id ?? `block-${index}`
        const aboveFold = index < 3

        switch (block.blockType) {
          case 'hero': {
            const b = block as HeroBlock
            return (
              <HeroBlockComponent
                key={key}
                image={b.image}
                eyebrow={b.eyebrow}
                heading={b.heading}
                highlightedText={b.highlightedText}
                subtitle={b.subtitle}
                supportingText={b.supportingText}
                buttons={b.buttons}
                overlayStyle={b.overlayStyle}
                minHeight={b.minHeight}
                semanticH1={b.semanticH1}
              />
            )
          }

          case 'content': {
            const b = block as ContentBlock
            return (
              <ContentBlockComponent
                key={key}
                heading={b.heading}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                body={b.body as any}
                image={b.image}
                alignment={b.alignment}
              />
            )
          }

          case 'cta': {
            const b = block as CTABlock
            return (
              <CTABlockComponent
                key={key}
                heading={b.heading}
                text={b.text}
                buttons={b.buttons}
                colorPreset={b.colorPreset}
                backgroundImage={b.backgroundImage}
              />
            )
          }

          case 'cardGrid': {
            const b = block as CardGridBlock
            return (
              <CardGridBlockComponent
                key={key}
                dataSource={b.dataSource}
                campusFilter={b.campusFilter}
              />
            )
          }

          case 'accordion': {
            const b = block as AccordionBlock
            return (
              <AccordionBlockComponent
                key={key}
                heading={b.heading}
                items={b.items}
                allowMultiple={b.allowMultiple}
              />
            )
          }

          case 'imageGallery': {
            const b = block as ImageGalleryBlock
            return <ImageGalleryBlockComponent key={key} images={b.images} />
          }

          case 'video': {
            const b = block as VideoBlock
            return <VideoBlockComponent key={key} url={b.url} caption={b.caption} />
          }

          case 'featureGrid': {
            const b = block as FeatureGridBlock
            return (
              <FeatureGridBlockComponent
                key={key}
                eyebrow={b.eyebrow}
                heading={b.heading}
                description={b.description}
                layout={b.layout}
                style={b.style}
                items={b.items}
                accentColor={b.accentColor}
              />
            )
          }

          case 'timeline': {
            const b = block as TimelineBlock
            return (
              <TimelineBlockComponent
                key={key}
                eyebrow={b.eyebrow}
                heading={b.heading}
                description={b.description}
                theme={b.theme}
                events={b.events}
              />
            )
          }

          case 'statsGrid': {
            const b = block as StatsGridBlock
            return (
              <StatsGridBlockComponent
                key={key}
                eyebrow={b.eyebrow}
                heading={b.heading}
                description={b.description}
                items={b.items}
              />
            )
          }

          case 'blockquote': {
            const b = block as BlockquoteBlockType
            return (
              <BlockquoteBlockComponent
                key={key}
                quote={b.quote}
                attribution={b.attribution}
                style={b.style}
              />
            )
          }

          case 'formEmbed': {
            const b = block as FormEmbedBlock
            return (
              <FormEmbedBlockComponent
                key={key}
                eyebrow={b.eyebrow}
                heading={b.heading}
                description={b.description}
                formType={b.formType}
                formTitle={b.formTitle}
                layout={b.layout}
              />
            )
          }

          case 'manualCardGrid': {
            const b = block as ManualCardGridBlock
            return (
              <ManualCardGridBlockComponent
                key={key}
                eyebrow={b.eyebrow}
                heading={b.heading}
                description={b.description}
                cardStyle={b.cardStyle}
                columns={b.columns}
                cards={b.cards}
                priority={aboveFold}
              />
            )
          }

          case 'photoStrip': {
            const b = block as PhotoStripBlock
            return (
              <PhotoStripBlockComponent
                key={key}
                layout={b.layout}
                images={b.images}
              />
            )
          }

          case 'pageHeader': {
            const b = block as PageHeaderBlock
            return (
              <PageHeaderBlockComponent
                key={key}
                eyebrow={b.eyebrow}
                heading={b.heading}
                description={b.description}
                theme={b.theme}
              />
            )
          }

          case 'gospelStepper': {
            const b = block as GospelStepperBlockType
            return (
              <GospelStepperBlockComponent
                key={key}
                heading={b.heading}
                steps={b.steps}
                finalCTA={b.finalCTA}
              />
            )
          }

          case 'latestSermon': {
            const b = block as LatestSermonBlockType
            return <LatestSermonBlockComponent key={key} heading={b.heading} />
          }

          default:
            return null
        }
      })}
    </>
  )
}
